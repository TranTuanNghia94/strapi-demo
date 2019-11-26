'use strict';

/**
 * Airport.js controller
 *
 * @description: A set of functions called "actions" for managing `Airport`.
 */

module.exports = {

  /**
   * Retrieve airport records.
   *
   * @return {Object|Array}
   */

  find: async (ctx, next, { populate } = {}) => {
    if (ctx.query._q) {
      return strapi.services.airport.search(ctx.query);
    } else {
      return strapi.services.airport.fetchAll(ctx.query, populate);
    }
  },

  /**
   * Retrieve a airport record.
   *
   * @return {Object}
   */

  findOne: async (ctx) => {
    if (!ctx.params._id.match(/^[0-9a-fA-F]{24}$/)) {
      return ctx.notFound();
    }

    return strapi.services.airport.fetch(ctx.params);
  },

  /**
   * Count airport records.
   *
   * @return {Number}
   */

  count: async (ctx) => {
    return strapi.services.airport.count(ctx.query);
  },

  /**
   * Create a/an airport record.
   *
   * @return {Object}
   */

  create: async (ctx) => {
    return strapi.services.airport.add(ctx.request.body);
  },

  /**
   * Update a/an airport record.
   *
   * @return {Object}
   */

  update: async (ctx, next) => {
    return strapi.services.airport.edit(ctx.params, ctx.request.body) ;
  },

  /**
   * Destroy a/an airport record.
   *
   * @return {Object}
   */

  destroy: async (ctx, next) => {
    return strapi.services.airport.remove(ctx.params);
  }
};
