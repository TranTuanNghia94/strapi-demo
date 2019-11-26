'use strict';

/* global Task */

/**
 * Task.js service
 *
 * @description: A set of functions similar to controller's actions to avoid code duplication.
 */

// Public dependencies.
const _ = require('lodash');
const { convertRestQueryParams, buildQuery } = require('strapi-utils');

module.exports = {
  /**
   * Promise to fetch all tasks.
   *
   * @return {Promise}
   */

  fetchAll: (params, populate) => {
    const filters = convertRestQueryParams(params);
    const populateOpt =
      populate ||
      Task.associations
        .filter(ast => ast.autoPopulate !== false)
        .map(ast => ast.alias);

    return buildQuery({
      model: Task,
      filters,
      populate: populateOpt,
    });
  },

  /**
   * Promise to fetch a/an task.
   *
   * @return {Promise}
   */

  fetch: params => {
    // Select field to populate.
    const populate = Task.associations
      .filter(ast => ast.autoPopulate !== false)
      .map(ast => ast.alias)
      .join(' ');

    return Task.findOne(_.pick(params, _.keys(Task.schema.paths))).populate(
      populate
    );
  },

  /**
   * Promise to count tasks.
   *
   * @return {Promise}
   */

  count: params => {
    const filters = convertRestQueryParams(params);

    return buildQuery({
      model: Task,
      filters: { where: filters.where },
    }).count();
  },

  /**
   * Promise to add a/an task.
   *
   * @return {Promise}
   */

  add: async values => {
    // Extract values related to relational data.
    const relations = _.pick(values, Task.associations.map(ast => ast.alias));
    const data = _.omit(values, Task.associations.map(ast => ast.alias));

    // Create entry with no-relational data.
    const entry = await Task.create(data);

    // Create relational data and return the entry.
    return Task.updateRelations({ _id: entry.id, values: relations });
  },

  /**
   * Promise to edit a/an task.
   *
   * @return {Promise}
   */

  edit: async (params, values) => {
    // Extract values related to relational data.
    const relations = _.pick(values, Task.associations.map(a => a.alias));
    const data = _.omit(values, Task.associations.map(a => a.alias));

    // Update entry with no-relational data.
    const entry = await Task.updateOne(params, data, { multi: true });

    // Update relational data and return the entry.
    return Task.updateRelations(Object.assign(params, { values: relations }));
  },

  /**
   * Promise to remove a/an task.
   *
   * @return {Promise}
   */

  remove: async params => {
    // Select field to populate.
    const populate = Task.associations
      .filter(ast => ast.autoPopulate !== false)
      .map(ast => ast.alias)
      .join(' ');

    // Note: To get the full response of Mongo, use the `remove()` method
    // or add spent the parameter `{ passRawResult: true }` as second argument.
    const data = await Task.findOneAndRemove(params, {}).populate(populate);

    if (!data) {
      return data;
    }

    await Promise.all(
      Task.associations.map(async association => {
        if (!association.via || !data._id || association.dominant) {
          return true;
        }

        const search =
          _.endsWith(association.nature, 'One') ||
          association.nature === 'oneToMany'
            ? { [association.via]: data._id }
            : { [association.via]: { $in: [data._id] } };
        const update =
          _.endsWith(association.nature, 'One') ||
          association.nature === 'oneToMany'
            ? { [association.via]: null }
            : { $pull: { [association.via]: data._id } };

        // Retrieve model.
        const model = association.plugin
          ? strapi.plugins[association.plugin].models[
            association.model || association.collection
          ]
          : strapi.models[association.model || association.collection];

        return model.update(search, update, { multi: true });
      })
    );

    return data;
  },

  /**
   * Promise to search a/an task.
   *
   * @return {Promise}
   */

  search: async params => {
    // Convert `params` object to filters compatible with Mongo.
    const filters = strapi.utils.models.convertParams('task', params);
    // Select field to populate.
    const populate = Task.associations
      .filter(ast => ast.autoPopulate !== false)
      .map(ast => ast.alias)
      .join(' ');

    const $or = Object.keys(Task.attributes).reduce((acc, curr) => {
      switch (Task.attributes[curr].type) {
        case 'integer':
        case 'float':
        case 'decimal':
          if (!_.isNaN(_.toNumber(params._q))) {
            return acc.concat({ [curr]: params._q });
          }

          return acc;
        case 'string':
        case 'text':
        case 'password':
          return acc.concat({ [curr]: { $regex: params._q, $options: 'i' } });
        case 'boolean':
          if (params._q === 'true' || params._q === 'false') {
            return acc.concat({ [curr]: params._q === 'true' });
          }

          return acc;
        default:
          return acc;
      }
    }, []);

    return Task.find({ $or })
      .sort(filters.sort)
      .skip(filters.start)
      .limit(filters.limit)
      .populate(populate);
  },

  traveler: async params => {
    return Task.find({ assign: params.id }).populate([{
      path: "orderitem",
      populate: {
        path: "product"
      }
    }, {
      path: "trip", 
      populate: [{
        path: "from"
      }, {
        path: "to"
      }]
    }, {
      path: "product_photos"
    }]);
  },

  fetchOneByTraveler: params => {
    return Task.findOne(params).populate([{
      path: "orderitem",
      populate: [{
        path: "product"
      }, {
        path: "where_to_buy_location"
      }]
    }, {
      path: "delivery_location"
    }, {
      path: "trip", 
      populate: [{
        path: "from"
      }, {
        path: "to"
      }]
    }, {
      path: "product_photos"
    }])
  }
};
