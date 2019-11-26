const queue = require('queue');
const cheerio = require('cheerio');
const axios = require('axios');
const _ = require('lodash');
const fs = require('fs');
const shortid = require('shortid-36');
const { join } = require('path');
const { toCode } = require('../../../../ultil');

module.exports = {
    crawl: () => {
        strapi.sendWebhookTelegram(`Started crawling Instamart's data`);
        if (!fs.existsSync(join(__dirname, 'logs'))) {
            fs.mkdirSync(join(__dirname, 'logs'));
        }
        const logs = [];
        const logName = join(__dirname, 'logs', `crawl_${new Date().toLocaleString().replace(/[/: ,]+/g, '-')}.txt`);
        const logToFile = async (log) => {
            logs.push(new Date().toLocaleString() + ': ' + log);
            fs.writeFileSync(logName, logs.join('\n'), 'utf8', function (err) {
                err && strapi.log.error(err);
            });
        }
        const categoriesQueue = new queue({ autostart: true, concurrency: 1 });
        const listQueue = new queue({ autostart: true, concurrency: 1 });
        const productsQueue = new queue({ autostart: true, concurrency: 1 });
        const headers = {
            'X-Requested-With': 'XMLHttpRequest',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/63.0.3239.132 Safari/537.36',
        };
        const Accept = 'text/javascript, application/javascript, application/ecmascript, application/x-ecmascript, */*; q=0.01';
        const output = __dirname + '/data/' + (new Date().toISOString()) + '/products.json';

        const products = [];

        if (!fs.existsSync(__dirname + '/data/')) {
            fs.mkdirSync(__dirname + '/data/');
        }
        if (!fs.existsSync(output.replace('/products.json', ''))) {
            fs.mkdirSync(output.replace('/products.json', ''));
        }

        const saveFile = async () => {
            try {
                await new Promise((res, rej) => {
                    fs.writeFile(output, JSON.stringify(products), 'utf8', (error) => {
                        if (error) {
                            logToFile('Can\'t save JSON file ERROR ' + error);
                            rej(error);
                            return;
                        }
                        res();
                    });
                })
            } catch (error) {
                strapi.log.debug('Can\'t save JSON file');
            }
        }

        const addProductQueue = (options) => {
            productsQueue.push(async (cb) => {
                try {
                    const response = await axios({
                        method: 'get',
                        url: options.url,
                        headers
                    });
                    products.push(_.assign(response.data, { categories: options.path, url: options.url }));
                } catch (error) {
                    logToFile('productsQueue ERROR' + error);
                    if (!options.times) {
                        options.times = 1;
                        addProductQueue(options)
                    }
                }
                strapi.log.debug(`Crawler job: ${products.length}|${productsQueue.length - 1} (product added |rest)`)
                if (productsQueue.length < 2) {
                    strapi.sendWebhookTelegram(`Completed crawling Instamart's data (${products.length})`);
                    await saveFile();
                    module.exports.update(output);
                }
                cb()
            })
        }

        const addListQueue = (options) => {
            listQueue.push(async (cb) => {
                try {
                    const { data } = await axios({
                        method: 'get',
                        url: options.url,
                        headers: _.assign({ Accept }, headers),
                    });
                    const html = data
                        .slice(data.indexOf('$("<li') + 3, data.indexOf('Instamart.variants') - 4)
                        .replace(/\\"/g, '"')
                        .replace(/\\\'/g, '\'')
                        .replace(/\\\//g, '/')
                    const $ = cheerio.load(html);
                    const hrefs = Array.from($('a')).map((e) => $(e).attr('href'));
                    hrefs.forEach((href) => {
                        addProductQueue({
                            url: 'https://instamart.ru/api/stores/112/products/' + _.last(href.split('/')),
                            path: options.path,
                        })
                    });
                } catch (error) {
                    strapi.log.error(error);
                    if (!options.times) {
                        options.times = 1;
                        addListQueue(options)
                    }
                }
                cb()
            })
        }

        const addCatQueue = (options) => {
            categoriesQueue.push(async (cb) => {
                try {
                    const response = await axios({
                        method: 'get',
                        url: options.url,
                        headers,
                        responseType: 'document'
                    });
                    const $ = cheerio.load(response.data);
                    let $aes = Array.from($('.filter-item .filter-item__count'));
                    if ($aes.length) {
                        let sum = _.sumBy($aes.map(e => parseInt($(e).text())));
                        let n = Math.ceil(sum / 24);
                        for (var i = 0; i < n; i++) {
                            addListQueue({
                                url: options.url.replace('?sid=112', '') + '/page/' + (i + 1),
                                path: options.path,
                            })
                        }
                    } else if ($('.side_filters').length) {
                        let hrefs = Array.from($('.product__link')).map(e => $(e).attr('href'));
                        hrefs.forEach(url => {
                            addProductQueue({
                                url: 'https://instamart.ru/api/stores/112/products/' + _.last(url.split('/')),
                                path: options.path,
                            })
                        })
                    } else {
                        let cats = Array.from($('.products .show-all')).map(e => 'https://instamart.ru' + $(e).attr('href'));
                        cats.filter(c => c).forEach(url => {
                            addCatQueue({
                                url,
                                path: options.path,
                            })
                        });
                    }
                } catch (error) {
                    strapi.log.error(error);
                    if (!options.times) {
                        options.times = 1;
                        addCatQueue(options)
                    }
                }
                cb();
            })
        }

        try {
            const categories = require('./categories.json');
            categories.forEach(c => {
                addCatQueue(c)
            })
        } catch (error) {
            strapi.log.console.warn(error);
        }
    },

    update: async (path) => {
        const logs = [];
        const logName = join(__dirname, 'logs', `update_${new Date().toLocaleString().replace(/[/: ,]+/g, '-')}.txt`);
        const logToFile = async (log) => {
            logs.push(new Date().toLocaleString() + ': ' + log);
            fs.writeFileSync(logName, logs.join('\n'), 'utf8', function (err) {
                err && strapi.log.error(err);
            });
        }
        if (!path) {
            const isDirectory = source => fs.lstatSync(source).isDirectory()
            const getDirectories = source =>
                fs.readdirSync(source).map(name => join(source, name)).filter(isDirectory);

            const datas = getDirectories(__dirname + '/data/');
            if (!datas.length) return;
            var newProds = require(_.first(datas) + '/products.json');
            if (!newProds) return;
        } else {
            var newProds = require(path);
        }
        const products = fs.existsSync(__dirname + '/products.json') ? require('./products.json') : [];

        if (!fs.existsSync(__dirname + '/images/')) {
            fs.mkdirSync(__dirname + '/images/');
        }

        const categories = await strapi.services.category.find({ _limit: 500, _start: 0 });
        const vendor = await Vendor.findOne({ code: 'instamart' });
        const currency = await Currency.findOne({ code: 'VND' });
        var added = 0, updated = 0, imageUpdated = 0;

        async function getCategory(name, parentName) {
            if (!name) return undefined;
            let category = _.find(categories, { name });
            if (!category) {
                let parent = _.find(categories, { name: parentName });
                let code = toCode(name);
                category = await strapi.services.category.create({ name, code, parent: _.get(parent, 'id') });
                categories.push(category);
            }
            return category;
        }

        function groundUp(value) {
            return Math.ceil(Math.round(value) / 1000) * 1000;
        }

        const formatProduct = async (data) => {
            let weight = data.productProperties.find((e) => e.name === 'Вес');
            let packing;
            if (weight && weight.value.includes('кг')) {
                weight = weight && weight.value.replace('кг', '').replace(',', '.');
                packing = 'kg';
            }
            let paths = data.categories.split('/');
            let category;
            for (let i = 0; i < paths.length; i++) {
                let cat = paths[i];
                let prevCat = _.get(paths, i - 1);
                category = await getCategory(cat, prevCat);
            }

            return {
                name: data.product.name,
                detail: data.product.description,
                url_encode: data.product.name ? toCode(data.product.name) : '',
                vendor: vendor.id,
                characteristics: data.productProperties,
                public: true,
                category: category.id,
                category_code: category.code,
                gender: 'unisex',
                tag: data.tag,
                volume: (weight || 0) * 1000,
                packing,
            }
        }

        const formatSku = (data) => {
            let price = groundUp(_.get(data, 'product.offer.instamart_price') * 360);
            let weight = data.productProperties.find((e) => e.name === 'Вес');
            if (weight && weight.value.includes('кг')) {
                weight = weight && weight.value.replace('кг', '').replace(',', '.');
            }
            return {
                source_url: data.url,
                currency: currency.id,
                price,
                original_price: price,
                airbasket_price: price,
                airbasket_fee: groundUp(price * 5 / 100),
                reward: groundUp(165 * 1000 * (weight || 0)),
            }
        }

        const updateProd = async (prevIndex, data) => {
            let prevData = products[prevIndex];
            var isUpdate = false;

            let sf = formatSku(data);
            let psf = formatSku(prevData);
            if (!_.isEqual(sf, psf)) {
                await strapi.services.sku.update({ _id: prevData._skuId }, sf);
                isUpdate = true;
            }

            let pf = await formatProduct(data);
            let ppf = await formatProduct(prevData);
            // if (!_.isEqual(ppf, pf)) {
                await strapi.services.product.update({ _id: prevData._productId }, pf, { multi: true });
                isUpdate = true;
            // }

            if (_.get(prevData, 'product.images[0].original_url') !== _.get(data, 'product.images[0].original_url')) {
                downloadImageQueue({
                    url,
                    params: {
                        id: prevData._skuId,
                        model: 'sku',
                    },
                    source: 'content-manager',
                    productId: prevData._id,
                    name: pf.url_encode,
                    path: __dirname + '/images/' + pf.url_encode + '.jpg'
                })
            }

            products[prevIndex] = _.assign(prevData, data);
            isUpdate && updated++;
        }

        const addProd = async (data) => {
            let sf = formatSku(data);
            sf.code = shortid.generate();
            let _sku = await strapi.services.sku.create(sf);
            let pf = await formatProduct(data);
            pf.sku = _sku.id;
            pf.skus = [_sku.id];
            pf.code = shortid.generate();
            let _product = await strapi.services.product.create(pf);
            products.push(_.assign(data, { _productId: _product._id, _skuId: _sku._id }));
            added++;

            let url = _.get(data, 'product.images[0].original_url')
            downloadImageQueue({
                url,
                params: {
                    id: _sku.id,
                    model: 'sku',
                },
                source: 'content-manager',
                productId: _product.id,
                name: _product.url_encode,
                path: __dirname + '/images/' + _product.url_encode + '.jpg'
            })
        }

        const downloadImage = (options) => {
            return axios({
                url: options.url,
                responseType: 'stream',
            }).then(
                response =>
                    new Promise((resolve, reject) => {
                        response.data
                            .pipe(fs.createWriteStream(options.path))
                            .on('finish', () => resolve())
                            .on('error', e => reject(e));
                    }),
            );
        }

        const imageQueue = new queue({ autostart: true, concurrency: 1 });
        const imageUpload = fs.existsSync(__dirname + '/images.json') ? require('./images.json') : [];

        const downloadImageQueue = (options) => {
            imageQueue.push(async (cb) => {
                try {
                    await downloadImage(options);
                    let files = {
                        photos: [{
                            path: options.path,
                            name: options.name,
                            type: 'image/jpeg',
                            size: fs.statSync(options.path).size
                        }]
                    }
                    let image = await strapi.plugins.upload.services.upload.uploadToEntity(
                        options.params,
                        files,
                        options.source,
                    );
                    imageUpload.push({
                        options,
                        image
                    });
                    imageUpdated++;
                    strapi.log.debug(`Image job ${imageUpdated}|${imageQueue.length - 1} (image updated | rest)`)
                } catch (e) {
                    strapi.log.error('downloadImageQueue ERROR: ' + e);
                    logToFile('downloadImageQueue ERROR: ' + e)
                }

                if (imageQueue.length < 2) {
                    fs.writeFile(__dirname + '/images.json', JSON.stringify(imageUpload), 'utf8', (error) => {
                        if (error) {
                            strapi.log.error('complete with error ' + error)
                            return;
                        }
                        strapi.log.debug('save file completed')
                    });
                    strapi.sendWebhookTelegram(`Completed updating instamart's image. Images updated: (${imageUpdated})`);
                }
                cb();
            })
        }

        const q = new queue({ concurrency: 1 });

        newProds.forEach((data) => {
            q.push(async (cb) => {
                try {
                    let index = _.findIndex(products, (d) => d.product.id === data.product.id);
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

        q.start((err) => {
            err && strapi.log.error(err);
            fs.writeFile(__dirname + '/products.json', JSON.stringify(products), 'utf8', () => {
                logToFile(`Completed updating instamart's data (updated: ${updated}, added: ${added})`);
                strapi.sendWebhookTelegram(`Completed updating instamart's data (updated: ${updated}, added: ${added})`);
            })
        })
    }
}