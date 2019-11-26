'use strict';

const { assign } = require('lodash');
const moment = require('moment');
var shortid = require('shortid');

/**
 * Order.js controller
 *
 * @description: A set of functions called "actions" for managing `Order`.
 */

module.exports = {

  /**
   * Retrieve order records.
   *
   * @return {Object|Array}
   */

  find: async (ctx, next, { populate } = {}) => {
    if (ctx.query._q) {
      return strapi.services.order.search(ctx.query);
    } else {
      return strapi.services.order.fetchAll(ctx.query, populate);
    }
  },

  /**
   * Retrieve a order record.
   *
   * @return {Object}
   */

  findOne: async (ctx) => {
    if (!ctx.params._id.match(/^[0-9a-fA-F]{24}$/)) {
      if (shortid.isValid(ctx.params._id)) {
        return strapi.services.order.fetch({ code: ctx.params._id }, [{
          path: "orderitems",
          populate: [{
            path: "sku",
            populate: [{
              path: 'product',
            }, {
              path: 'currency'
            }]
          }]
        }]);
      }
      return ctx.notFound();
    }

    return strapi.services.order.fetch(ctx.params);
  },

  /**
   * Count order records.
   *
   * @return {Number}
   */

  count: async (ctx) => {
    return strapi.services.order.count(ctx.query);
  },

  /**
   * Create a/an order record.
   *
   * @return {Object}
   */

  create: async (ctx) => {
    return strapi.services.order.add(ctx.request.body);
  },

  /**
   * Create a/an order record.
   *
   * @return {Object}
   */

  checkout: async (ctx) => {
    const user = ctx.state.user;
    if (!user) {
      return ctx.badRequest(null, [{ messages: [{ id: 'No authorization header was found' }] }]);
    }

    let body = assign({
      user: user.id || user._id,
      delivery_address: user.address,
      phone: user.phone,
      recipient_name: `${user.firstname} ${user.lastname}`,
      delivery_date: moment().add(21, 'days').toDate(),
      status: 'pending',
    }, ctx.request.body);

    return strapi.services.order.checkout(body);
  },

  /**
   * Update a/an order record.
   *
   * @return {Object}
   */

  update: async (ctx, next) => {
    return strapi.services.order.edit(ctx.params, ctx.request.body);
  },

  /**
   * Destroy a/an order record.
   *
   * @return {Object}
   */

  destroy: async (ctx, next) => {
    return strapi.services.order.remove(ctx.params);
  },

  findByOperator: async (ctx, next, { populate } = {}) => {
    const user = ctx.state.user;
    if (!user) {
      return ctx.badRequest(null, [{ messages: [{ id: 'No authorization header was found' }] }]);
    }
    return strapi.services.order.fetchByOperator();
  },
};
