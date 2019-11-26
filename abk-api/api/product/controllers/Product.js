'use strict';

/**
 * Read the documentation () to implement custom controller functions
 */
// Public dependencies.
const _ = require('lodash');
const { toCode } = require('../../../ultil.js');
const shortid = require('shortid-36');

module.exports = {
    /**
     * Retrieve airport records.
     *
     * @return {Object|Array}
     */

    find: async (ctx, next, { populate } = {}) => {
        if (ctx.query._q) {
            return strapi.services.product.search(ctx.query);
        } else {
            const user = ctx.state.user;
            if (user && user.role.type === 'operator') {
                return strapi.services.product.find(ctx.query, populate);
            }
            var query = _.assign({}, ctx.query, { public: true });
            return strapi.services.product.find(query, populate);
        }
    },

    /**
     * Retrieve a order record.
     *
     * @return {Object}
     */

    findOne: async (ctx) => {
        if (!ctx.params._id.match(/^[0-9a-fA-F]{24}$/)) {
            let populate = [{
                path: 'category',
            }, {
                path: 'sku',
                populate: [{
                    path: 'currency'
                }]
            }, {
                path: 'skus'
            }, {
                path: 'vendor',
                populate: [{
                    path: 'country'
                }]
            }];
            if (shortid.isValid(ctx.params._id)) {
                return Product.findOne({ code: ctx.params._id }).populate(populate);
            } else {
                return Product.findOne({ url_encode: ctx.params._id }).populate(populate);
            }
        }

        return Product.findOne(ctx.params);
    },

    /**
     * Create a/an product record.
     *
     * @return {Object}
     */

    create: async (ctx) => {
        const count = await strapi.services.product.count();

        let url_encode = toCode(`${ctx.request.body.name || ''}-${(count + 1).toString(36)}`);
        let code = shortid.generate();

        return strapi.services.product.add(_.assign({ url_encode, code }, ctx.request.body));
    },

    /**
     * Count product records.
     *
     * @return {Number}
     */

    count: async (ctx) => {
        return strapi.services.product.count(_.assign({ public: true }, ctx.query));
    },
};
