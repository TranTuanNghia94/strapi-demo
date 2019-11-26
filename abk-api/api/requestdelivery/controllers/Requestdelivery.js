'use strict';

const { assign } = require('lodash');

/**
 * Read the documentation () to implement custom controller functions
 */

module.exports = {

    /**
     * Create a/an order record.
     *
     * @return {Object}
     */

    create: async (ctx) => {
        const user = ctx.state.user;
        if (!user) {
            return ctx.badRequest(null, [{ messages: [{ id: 'No authorization header was found' }] }]);
        }
        var message =
            `Url: ${ctx.request.body.url}\n` +
            `Detail: ${ctx.request.body.detail}\n` +
            `User:\n` +
            ` - Name: ${user.firstname} ${user.lastname}\n` +
            ` - Phone: ${user.phone}\n` +
            ` - Email: ${user.email}`;

        var subject = `*ABK REQUEST DELIVERY ADDED*`;
        strapi.sendWebhookTelegram(`${subject}\n${message}\n`);
        return strapi.services.requestdelivery.create(assign({}, ctx.request.body, { user: user.id || user._id }));
    },
};
