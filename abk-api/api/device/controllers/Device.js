'use strict';

/**
 * Device.js controller
 *
 * @description: A set of functions called "actions" for managing `Device`.
 */

module.exports = {

  /**
   * Retrieve device records.
   *
   * @return {Object|Array}
   */

  find: async (ctx, next, { populate } = {}) => {
    if (ctx.query._q) {
      return strapi.services.device.search(ctx.query);
    } else {
      return strapi.services.device.fetchAll(ctx.query, populate);
    }
  },

  /**
   * Retrieve a device record.
   *
   * @return {Object}
   */

  findOne: async (ctx) => {
    if (!ctx.params._id.match(/^[0-9a-fA-F]{24}$/)) {
      return ctx.notFound();
    }

    return strapi.services.device.fetch(ctx.params);
  },

  /**
   * Count device records.
   *
   * @return {Number}
   */

  count: async (ctx) => {
    return strapi.services.device.count(ctx.query);
  },

  /**
   * Create a/an device record.
   *
   * @return {Object}
   */

  create: async (ctx) => {
    return strapi.services.device.add(ctx.request.body);
  },

  /**
   * Update a/an device record.
   *
   * @return {Object}
   */

  update: async (ctx, next) => {
    return strapi.services.device.edit(ctx.params, ctx.request.body) ;
  },

  /**
   * Destroy a/an device record.
   *
   * @return {Object}
   */

  destroy: async (ctx, next) => {
    return strapi.services.device.remove(ctx.params);
  }
};
