'use strict';

/**
 * Bank.js controller
 *
 * @description: A set of functions called "actions" for managing `Bank`.
 */

module.exports = {

  /**
   * Retrieve bank records.
   *
   * @return {Object|Array}
   */

  find: async (ctx, next, { populate } = {}) => {
    if (ctx.query._q) {
      return strapi.services.bank.search(ctx.query);
    } else {
      return strapi.services.bank.fetchAll(ctx.query, populate);
    }
  },

  /**
   * Retrieve a bank record.
   *
   * @return {Object}
   */

  findOne: async (ctx) => {
    if (!ctx.params._id.match(/^[0-9a-fA-F]{24}$/)) {
      return ctx.notFound();
    }

    return strapi.services.bank.fetch(ctx.params);
  },

  /**
   * Count bank records.
   *
   * @return {Number}
   */

  count: async (ctx) => {
    return strapi.services.bank.count(ctx.query);
  },

  /**
   * Create a/an bank record.
   *
   * @return {Object}
   */

  create: async (ctx) => {
    return strapi.services.bank.add(ctx.request.body);
  },

  /**
   * Update a/an bank record.
   *
   * @return {Object}
   */

  update: async (ctx, next) => {
    return strapi.services.bank.edit(ctx.params, ctx.request.body) ;
  },

  /**
   * Destroy a/an bank record.
   *
   * @return {Object}
   */

  destroy: async (ctx, next) => {
    return strapi.services.bank.remove(ctx.params);
  }
};
