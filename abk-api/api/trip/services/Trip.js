'use strict';

/* global Trip */

/**
 * Trip.js service
 *
 * @description: A set of functions similar to controller's actions to avoid code duplication.
 */

// Public dependencies.
const _ = require('lodash');
const moment = require('moment');
const axios = require('axios');
const { convertRestQueryParams, buildQuery } = require('strapi-utils');

module.exports = {

  /**
   * Promise to fetch all trips.
   *
   * @return {Promise}
   */

  fetchAll: (params, populate) => {
    const filters = convertRestQueryParams(params);
    const populateOpt = populate || Trip.associations
      .filter(ast => ast.autoPopulate !== false)
      .map(ast => ast.alias)

    return buildQuery({
      model: Trip,
      filters,
      populate: populateOpt,
    });
  },

  /**
   * Promise to fetch a/an trip.
   *
   * @return {Promise}
   */

  fetch: (params) => {
    // Select field to populate.
    const populate = Trip.associations
      .filter(ast => ast.autoPopulate !== false)
      .map(ast => ast.alias)
      .join(' ');

    return Trip
      .findOne(_.pick(params, _.keys(Trip.schema.paths)))
      .populate(populate);
  },

  /**
   * Promise to count trips.
   *
   * @return {Promise}
   */

  count: (params) => {
    const filters = convertRestQueryParams(params);

    return buildQuery({
      model: Trip,
      filters: { where: filters.where },
    })
      .count()
  },

  /**
   * Promise to add a/an trip.
   *
   * @return {Promise}
   */

  add: async (values) => {
    // Extract values related to relational data.
    const relations = _.pick(values, Trip.associations.map(ast => ast.alias));
    const data = _.omit(values, Trip.associations.map(ast => ast.alias));

    const count = await buildQuery({ model: Trip }).count();

    data.code = "TRI" + count.toString(16).toUpperCase();

    // Create entry with no-relational data.
    const entry = await Trip.create(data);

    // Create relational data and return the entry.
    const trip = await Trip.updateRelations({ _id: entry.id, values: relations });

    // // send an email to operator
    // try {
    //   const pluginStore = strapi.store({
    //     environment: '',
    //     type: 'plugin',
    //     name: 'users-permissions',
    //   });
    //   const storeEmail =
    //     (await pluginStore.get({
    //       key: 'email',
    //     })) || {};

    //   const settings = storeEmail['email_confirmation']
    //     ? storeEmail['email_confirmation'].options
    //     : {};

    var message =
      `Code: ${trip.code}\n` +
      `Name: ${trip.name}\n` +
      `Date: ${moment(trip.date).format('DD MMM YYYY')}\n` +
      `From:\n` +
      `- Name: ${trip.from.name}\n` +
      `- Code: ${trip.from.code}\n` +
      `To:\n` +
      `- Name: ${trip.to.name}\n` +
      `- Code: ${trip.to.code}\n` +
      `User:\n` +
      `- Name: ${trip.user.firstname} ${trip.user.lastname}\n` +
      `- Phone: ${trip.user.phone}\n` +
      `- Email: ${trip.user.email}`;

    var subject = `*ABK TRIP ADDED* (${trip.from.code} - ${trip.to.code}) ${moment(trip.date).format('DD MMM YYYY')} ${trip.user.firstname} ${trip.user.lastname}`;
    axios.post(strapi.config.currentEnvironment.telegramWebHook, {
      text: `${subject}\n${message}\n`
    });

    //   // Send an email to the user.
    //   await strapi.plugins['email'].services.email.send({
    //     to: 'hello@airbasket.com',
    //     from:
    //       settings.from.email && settings.from.name
    //         ? `"${settings.from.name}" <${settings.from.email}>`
    //         : undefined,
    //     replyTo: settings.response_email,
    //     subject: settings.object,
    //     text: settings.message,
    //     html: settings.message,
    //   });
    //   strapi.services.emailservice.add({
    //     storeEmail: 'trip_added',
    //     timestamp: new Date().getTime(),
    //     status: 'sent',
    //     priority: 1,
    //     params: {},
    //     users: []
    //   });
    // } catch (err) {
    //   console.error(err)
    // }
    return trip
  },

  /**
   * Promise to edit a/an trip.
   *
   * @return {Promise}
   */

  edit: async (params, values) => {
    // Extract values related to relational data.
    const relations = _.pick(values, Trip.associations.map(a => a.alias));
    const data = _.omit(values, Trip.associations.map(a => a.alias));

    // Update entry with no-relational data.
    const entry = await Trip.updateOne(params, data, { multi: true });

    // Update relational data and return the entry.
    return Trip.updateRelations(Object.assign(params, { values: relations }));
  },

  /**
   * Promise to remove a/an trip.
   *
   * @return {Promise}
   */

  remove: async params => {
    // Select field to populate.
    const populate = Trip.associations
      .filter(ast => ast.autoPopulate !== false)
      .map(ast => ast.alias)
      .join(' ');

    // Note: To get the full response of Mongo, use the `remove()` method
    // or add spent the parameter `{ passRawResult: true }` as second argument.
    const data = await Trip
      .findOneAndRemove(params, {})
      .populate(populate);

    if (!data) {
      return data;
    }

    await Promise.all(
      Trip.associations.map(async association => {
        if (!association.via || !data._id || association.dominant) {
          return true;
        }

        const search = _.endsWith(association.nature, 'One') || association.nature === 'oneToMany' ? { [association.via]: data._id } : { [association.via]: { $in: [data._id] } };
        const update = _.endsWith(association.nature, 'One') || association.nature === 'oneToMany' ? { [association.via]: null } : { $pull: { [association.via]: data._id } };

        // Retrieve model.
        const model = association.plugin ?
          strapi.plugins[association.plugin].models[association.model || association.collection] :
          strapi.models[association.model || association.collection];

        return model.update(search, update, { multi: true });
      })
    );

    return data;
  },

  /**
   * Promise to search a/an trip.
   *
   * @return {Promise}
   */

  search: async (params) => {
    // Convert `params` object to filters compatible with Mongo.
    const filters = strapi.utils.models.convertParams('trip', params);
    // Select field to populate.
    const populate = Trip.associations
      .filter(ast => ast.autoPopulate !== false)
      .map(ast => ast.alias)
      .join(' ');

    const $or = Object.keys(Trip.attributes).reduce((acc, curr) => {
      switch (Trip.attributes[curr].type) {
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

    return Trip
      .find({ $or })
      .sort(filters.sort)
      .skip(filters.start)
      .limit(filters.limit)
      .populate(populate);
  },

  traveler: (params) => {
    const filters = convertRestQueryParams({ user: params.id, disabled_ne: true });

    return buildQuery({
      model: Trip,
      filters,
      populate: [{
        path: "tasks",
        populate: [{
          path: "product_photos"
        }, {
          path: "orderitem",
          populate: [{
            path: "product"
          }, {
            path: "where_to_buy_location"
          }]
        }, {
          path: "delivery_location"
        }]
      }, {
        path: "from"
      }, {
        path: "to"
      }],
    });
  }
};
