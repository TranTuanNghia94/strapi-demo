'use strict';

/**
 * Orderitem.js controller
 *
 * @description: A set of functions called "actions" for managing `Orderitem`.
 */

module.exports = {

  /**
   * Retrieve orderitem records.
   *
   * @return {Object|Array}
   */

  find: async (ctx, next, { populate } = {}) => {
    if (ctx.query._q) {
      return strapi.services.orderitem.search(ctx.query);
    } else {
      return strapi.services.orderitem.fetchAll(ctx.query, populate);
    }
  },

  /**
   * Retrieve a orderitem record.
   *
   * @return {Object}
   */

  findOne: async (ctx) => {
    if (!ctx.params._id.match(/^[0-9a-fA-F]{24}$/)) {
      return ctx.notFound();
    }

    return strapi.services.orderitem.fetch(ctx.params);
  },

  /**
   * Count orderitem records.
   *
   * @return {Number}
   */

  count: async (ctx) => {
    return strapi.services.orderitem.count(ctx.query);
  },

  /**
   * Create a/an orderitem record.
   *
   * @return {Object}
   */

  create: async (ctx) => {
    return strapi.services.orderitem.add(ctx.request.body);
  },

  /**
   * Update a/an orderitem record.
   *
   * @return {Object}
   */

  update: async (ctx, next) => {
    return strapi.services.orderitem.edit(ctx.params, ctx.request.body);
  },

  /**
   * Destroy a/an orderitem record.
   *
   * @return {Object}
   */

  destroy: async (ctx, next) => {
    return strapi.services.orderitem.remove(ctx.params);
  },

  findByOperator: async (ctx, next, { populate } = {}) => {
    const user = ctx.state.user;
    if (!user) {
      return ctx.badRequest(null, [{ messages: [{ id: 'No authorization header was found' }] }]);
    }
    return strapi.services.orderitem.fetchByOperator();
  },
};
