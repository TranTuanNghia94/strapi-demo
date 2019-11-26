'use strict';

const shortid = require('shortid-36');
const _ = require('lodash');

/**
 * Read the documentation () to implement custom controller functions
 */

module.exports = {

    /**
     * Create a/an airport record.
     *
     * @return {Object}
     */

    create: async (ctx) => {
        let code = shortid.generate();
        return strapi.services.sku.create(_.assign({ code }, ctx.request.body));
    },
};
