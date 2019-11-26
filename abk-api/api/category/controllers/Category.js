'use strict';

/**
 * Read the documentation () to implement custom controller functions
 */

const _ = require('lodash');
const { toCode } = require('../../../ultil.js');

module.exports = {

    /**
     * Retrieve a category record.
     *
     * @return {Object}
     */

    findOne: async (ctx) => {
        if (!ctx.params._id.match(/^[0-9a-fA-F]{24}$/)) {
            return Category.findOne({ code: ctx.params._id }).populate([{
                path: 'categories'
            }]);
        }

        return Category.findOne(ctx.params);
    },

    /**
     * Create a/an category record.
     *
     * @return {Object}
     */

    create: async (ctx) => {
        const count = await strapi.services.category.count();
        let code = toCode(`${ctx.request.body.name || ''}-${(count + 1).toString(36)}`);
        return strapi.services.category.create(_.assign({ code }, ctx.request.body));
    },

    /**
     * get Category Tree a/an category record.
     *
     * @return {Object}
     */

    findMenu: async (ctx) => {
        return strapi.services.category.find(ctx.query).where('parent').equals(null).populate([{
            path: 'categories',
            populate: [{
                path: 'categories',
                populate: [{
                    path: 'categories',
                }]
            }]
        }]);
    }
};
