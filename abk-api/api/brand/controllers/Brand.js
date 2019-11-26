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
        const count = await strapi.services.brand.count();
        let code = toCode(`${ctx.request.body.name || ''}-${(count + 1).toString(36)}`);
        return strapi.services.brand.create(_.assign({ code }, ctx.request.body));
    },
};
