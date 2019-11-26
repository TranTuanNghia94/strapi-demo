const { existsSync, mkdirSync, writeFile, statSync, createWriteStream, writeFileSync } = require("fs");
const { join } = require("path");
const queue = require("queue");
const axios = require("axios");
const cheerio = require("cheerio");
const { toCode } = require("../../../../ultil");
const shortid = require("shortid-36");
const _ = require("lodash");

module.exports = {
    processDetail: async ($, save, data, logToFile) => {
        var name = $('#product-page > div.product-info-container > div.head > h1').text().trim();
        if (!name.length) {
            logToFile('save ERROR product not found ' + data.url);
            return;
        }
        var image = $('#image > img').attr('src');
        var d = $('#product-page > div.product-info-container > div.product-params > div.params-inner');
        var characteristics = [];
        var texts = d.text().replace(/ /g, '').split('\n').filter(e => e.length);
        var brand, packing, volume, gender = 'unisex';
        for (var i = 0; i < texts.length; i += 2) {
            characteristics.push({
                id: shortid.generate(),
                name: texts[i],
                value: texts[i + 1]
            });
            if (texts[i] == 'Brand') {
                brand = texts[i + 1]
            } else if (texts[i] == 'Packing') {
                packing = texts[i + 1].toLowerCase();
            } else if (texts[i] == 'Volume') {
                volume = texts[i + 1].toLowerCase();
            } else if (texts[i] == 'Gender') {
                if (texts[i + 1].includes('women')) {
                    gender = 'female'
                } else if (texts[i + 1].includes('Unisex')) {
                    gender = 'unisex';
                } else {
                    gender = 'male';
                }
            }
        }
        var productPrice = $('#price-block > div > div.main-part > div.price-container > div.prices > span.price').text().trim();
        var discountPercent = $('#price-block > div > div.main-part > div.price-container > div.labels > div').text().trim();
        var priceOld = $('#price-block > div > div.main-part > div.price-container > div.prices > span.price-old').text().trim();
        var description = $('#product-description > div.description-container > div.inner').text().trim();
        var airportPrice = $('#price-block > div > div.attention-block > div.airport-price').text().trim();
        var whereToPickUp = $('#product-page > div.product-info-container > div.pickup-point > div.pickup-point-container').text().trim();
        var seller = $('#product-page > div.product-info-container > div.related-links-block > div.store-block > span').text().trim();
        save({
            crawl: {
                name,
                image,
                priceOld,
                productPrice,
                discountPercent,
                airportPrice,
                description,
                whereToPickUp,
                seller,
                characteristics,
                brand,
                packing,
                volume,
                gender,
            },
            product: data
        });
    },

    crawl: () => {
        strapi.sendWebhookTelegram(`Started crawling Mydutyfree's data`);
        if (!existsSync(join(__dirname, 'logs'))) {
            mkdirSync(join(__dirname, 'logs'));
        }
        const logs = [];
        const logName = join(__dirname, 'logs', `crawl_${new Date().toLocaleString().replace(/[/: ,]+/g, '-')}.txt`);
        const logToFile = async (log) => {
            logs.push(new Date().toLocaleString() + ': ' + log);
            writeFileSync(logName, logs.join('\n'), 'utf8', function (err) {
                err && strapi.log.error(err);
            });
        }
        const date = new Date().toISOString().slice(0, 10);
        const input = join(__dirname, 'input.json');
        const output = join(__dirname, 'data', date, 'products.json');
        if (!existsSync(join(__dirname, 'data'))) {
            mkdirSync(join(__dirname, 'data'));
        }
        if (!existsSync(join(__dirname, 'data', date))) {
            mkdirSync(join(__dirname, 'data', date));
        }
        const self = module.exports;

        const crawlProducts = existsSync(input) ? require('./input.json') : [];
        const productQueue = new queue({ concurrency: 1 });

        const products = [];

        const save = (data) => {
            products.push(data);
        }

        crawlProducts.forEach((p) => {
            productQueue.push(async (cb) => {
                try {
                    const response = await axios({
                        method: 'get',
                        url: p.url,
                        headers: {
                            'X-Requested-With': 'XMLHttpRequest',
                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/63.0.3239.132 Safari/537.36',
                        },
                        responseType: 'document'
                    });
                    const $ = cheerio.load(response.data);
                    self.processDetail($, save, p, logToFile)
                } catch (e) {
                    logToFile('crawlProducts ERROR ' + p.url + '\n' + e);
                }
                strapi.log.debug(`Crawler job: ${products.length}|${productQueue.length} (total product|rest)`)
                cb();
            })
        })

        productQueue.start((e) => {
            e && strapi.log.error(e);
            writeFile(output, JSON.stringify(products), 'utf8', (err) => {
                logToFile(`Completed crawling Mydutyfree's data (${products.length}/${crawlProducts.length})`);
                strapi.sendWebhookTelegram(`Completed crawling Mydutyfree's data (${products.length}/${crawlProducts.length})`);
                if (err) {
                    strapi.log.error(err);
                } else {
                    self.update(output);
                }
            });
        })
    },

    update: async (path) => {
        const logs = [];
        const logName = join(__dirname, 'logs', `update_${new Date().toLocaleString().replace(/[/: ,]+/g, '-')}.txt`);
        const logToFile = async (log) => {
            logs.push(new Date().toLocaleString() + ': ' + log);
            writeFileSync(logName, logs.join('\n'), 'utf8', function (err) {
                err && strapi.log.error(err);
            });
        }
        const vendor = await Vendor.findOne({ code: 'mydutyfree' });
        const currency = await Currency.findOne({ code: 'VND' });
        const category = await Category.findOne({ code: 'women' });
        const newProds = require(path);

        const productQueue = new queue({ concurrency: 1 });
        const imageQueue = new queue({ autostart: true, concurrency: 2 });
        const products = existsSync(__dirname + '/products.json') ? require('./products.json') : [];
        var added = 0, updated = 0, imageUpdated = 0;

        if (!existsSync(__dirname + '/images/')) {
            mkdirSync(__dirname + '/images/');
        }

        function groundUp(value) {
            return Math.ceil(Math.round(value) / 1000) * 1000;
        }

        const formatProduct = (data) => {
            return {
                name: data.product.name,
                detail: data.crawl.description,
                url_encode: data.product.name ? toCode(data.product.name) : '',
                vendor: vendor.id,
                characteristics: data.crawl.characteristics,
                public: true,
                category: category.id,
                category_code: category.code,
                gender: data.crawl.gender,
                volume: data.crawl.volume,
                packing: data.crawl.packing,
            }
        }

        const formatSku = (data) => {
            return {
                source_url: data.product.url,
                currency: currency.id,
                price: groundUp(data.product.price),
                original_price: groundUp(data.product.originalPrice * 25600),
                airbasket_price: groundUp(data.product.airbasketPrice),
                airbasket_fee: 0,
                reward: groundUp(data.product.reward),
            }
        }

        const updateProd = async (prevIndex, data) => {
            let prevData = products[prevIndex];

            let sf = formatSku(data);
            let psf = formatSku(prevData);
            var isUpdate = false;
            if (!_.isEqual(sf, psf)) {
                await strapi.services.sku.update({ _id: prevData._skuId }, sf);
                isUpdate = true;
            }

            let pf = formatProduct(data);
            let ppf = formatProduct(prevData);
            // if (!_.isEqual(ppf, pf)) {
                await strapi.services.product.update({ _id: prevData._productId }, pf, { multi: true });
                isUpdate = true;
            // }

            if (_.get(prevData, 'image.options.url') !== data.crawl.image) {
                downloadImageQueue({
                    url: data.crawl.image,
                    params: {
                        id: prevData._skuId,
                        model: 'sku',
                    },
                    source: 'content-manager',
                    productId: prevData._id,
                    name: toCode(data.product.name),
                    path: __dirname + '/images/' + toCode(data.product.name) + '.jpg'
                }, prevData)
            }

            products[prevIndex] = _.assign(prevData, data);
            if (isUpdate) { updated++; }
        }

        const addProd = async (data) => {
            let sf = formatSku(data);
            sf.code = shortid.generate();
            var _sku = await Sku.findOne({ source_url: sf.source_url });
            if (!_sku) {
                _sku = await strapi.services.sku.create(sf);
            }
            var _product;
            let pf = formatProduct(data);
            pf.sku = _sku.id;
            pf.skus = [_sku.id];
            pf.code = shortid.generate();

            let err = '';
            try {
                _product = await strapi.services.product.create(pf);
                added++;
                downloadImageQueue({
                    url: data.crawl.image,
                    params: {
                        id: _sku.id,
                        model: 'sku',
                    },
                    source: 'content-manager',
                    productId: _product.id,
                    name: _product.url_encode,
                    path: __dirname + '/images/' + _product.url_encode + '.jpg'
                }, data)
            } catch (e) {
                _product = await Product.findOne({ url_encode: pf.url_encode });
                if (!_product || _product.id) {
                    err = e;
                }
            }
            if (_product && _product.id) {
                products.push(_.assign(data, { _productId: _product._id, _skuId: _sku._id }));
            } else {
                logToFile('addProd ERROR: ' + err)
            }
        }

        const downloadImage = (options) => {
            return axios({
                url: options.url,
                responseType: 'stream',
            }).then(
                response =>
                    new Promise((resolve, reject) => {
                        response.data
                            .pipe(createWriteStream(options.path))
                            .on('finish', () => resolve())
                            .on('error', e => reject(e));
                    }),
            );
        }

        const downloadImageQueue = (options, data) => {
            imageQueue.push(async (cb) => {
                try {
                    await downloadImage(options);
                    let files = {
                        photos: [{
                            path: options.path,
                            name: options.name,
                            type: 'image/jpeg',
                            size: statSync(options.path).size
                        }]
                    }
                    let image = await strapi.plugins.upload.services.upload.uploadToEntity(
                        options.params,
                        files,
                        options.source,
                    );
                    _.assign(data, {
                        image: {
                            options,
                            image
                        }
                    });
                    imageUpdated++;
                } catch (e) {
                    logToFile('downloadImageQueue ERROR: ' + e)
                }

                if (imageQueue.length < 2) {
                    writeFile(__dirname + '/products.json', JSON.stringify(products), 'utf8', () => {
                        logToFile(`Completed updating mydutyfree's image (${imageUpdated})`);
                        strapi.sendWebhookTelegram(`Completed updating mydutyfree's image. Images updated: (${imageUpdated})`);
                    })
                }
                cb();
            })
        }

        newProds.forEach((data) => {
            productQueue.push(async (cb) => {
                try {
                    let index = _.findIndex(products, (d) => d.product.url === data.product.url);
                    if (index > -1) {
                        await updateProd(index, data);
                    } else {
                        await addProd(data);
                    }
                } catch (err) {
                    logToFile('productQueue ERROR: ' + err)
                }
                cb();
            })
        });

        productQueue.start((err) => {
            err && strapi.log.error(err);
            writeFile(__dirname + '/products.json', JSON.stringify(products), 'utf8', () => {
                logToFile(`Completed updating Mydutyfree's data (updated: ${updated}, added: ${added})`);
                strapi.sendWebhookTelegram(`Completed updating Mydutyfree's data (updated: ${updated}, added: ${added})`);
            })
        })
    }
}