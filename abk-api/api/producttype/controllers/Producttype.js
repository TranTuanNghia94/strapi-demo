'use strict';

/**
 * Read the documentation () to implement custom controller functions
 */

const _ = require('lodash');
const { toCode } = require('../../../ultil.js');

module.exports = {

    /**
     * Create a/an airport record.
     *
     * @return {Object}
     */

    create: async (ctx) => {
        let code = toCode(ctx.request.body.name || '');
        return strapi.services.producttype.create(_.assign({ code }, ctx.request.body));
    },
};
