/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule RelayMutation
 * @typechecks
 * @flow
 */

'use strict';

import type GraphQL from 'GraphQL';
var RelayDeprecated = require('RelayDeprecated');
var RelayFragmentReference = require('RelayFragmentReference');
import type RelayMetaRoute from 'RelayMetaRoute';
var RelayStore = require('RelayStore');
import type {Variables} from 'RelayTypes';

var buildRQL = require('buildRQL');
import type {FragmentBuilder} from 'buildRQL';
var forEachObject = require('forEachObject');
var fromGraphQL = require('fromGraphQL');
var invariant = require('invariant');
var warning = require('warning');

export type FileMap = {[key: string]: File};
export type RelayMutationFragments<Tk> = {
  [key: Tk]: FragmentBuilder;
};

/**
 * @public
 *
 * RelayMutation is the base class for modeling mutations of data.
 */
class RelayMutation<Tp: {[key: string]: mixed}> {
  static name: $FlowIssue;
  static fragments: RelayMutationFragments<$Enum<Tp>>;
  static initialVariables: Variables;
  static prepareVariables: ?(
    prevVariables: Variables,
    route: RelayMetaRoute
  ) => Variables;

  props: Tp;
  _didShowFakeDataWarning: boolean;

  constructor(props: Tp) {
    this._didShowFakeDataWarning = false;
    this._resolveProps(props);
  }

  /**
   * Each mutation has a server name which is used by clients to communicate the
   * type of mutation that should be executed on the server.
   */
  getMutation(): GraphQL.Mutation {
    invariant(
      false,
      '%s: Expected abstract method `getMutation` to be implemented.',
      this.constructor.name
    );
  }

  /**
   * "Fat queries" represent a predetermined set of fields that may change as a
   * result of a mutation, and which should therefore be queried in order to get
   * a consistent view of the data after performing a mutation. In practice, we
   * query for a subset of those fields because we intersect the fat query with
   * the tracked query we have for a given node (ie. the pieces of data we've
   * previously queried for and have therefore written to the store).
   *
   * Fat queries can be written like normal graphql queries with one main
   * exception: fat queries use childless non-scalar fields to indicate that
   * anything under that field may change. For example, the fat query for
   * feedback_like contains the field `like_sentence` with no child fields.
   * This means that any field below `like_sentence` may change as a result of
   * feedback_like.
   *
   * When adding a fat query, consider *all* of the data that might change as a
   * result of the mutation - not just data that we currently use in Relay. We
   * don't need to worry about overfetching here (this query is never executed
   * on its own; the infrastructure always intersects it with what is actually
   * needed), and if we omit fields here we might get odd consistency behavior
   * in the future when we add new views or modify existing ones.
   */
  getFatQuery(): GraphQL.Fragment {
    invariant(
      false,
      '%s: Expected abstract method `getFatQuery` to be implemented.',
      this.constructor.name
    );
  }

  /**
   * These configurations are used to generate the query for the mutation to be
   * sent to the server and to correctly write the server's response into the
   * client store.
   *
   * Possible configuration types:
   *
   * -  FIELDS_CHANGE provides configuration for mutation fields.
   *    {
   *      type: RelayMutationType.FIELDS_CHANGE;
   *      fieldIDs: {[fieldName: string]: DataID | Array<DataID>};
   *    }
   *    where fieldIDs map `fieldName`s from the fatQuery to a DataID or
   *    array of DataIDs to be updated in the store.
   *
   * -  RANGE_ADD provides configuration for adding a new edge to a range.
   *    {
   *      type: RelayMutationType.RANGE_ADD;
   *      parentName: string;
   *      parentID: string;
   *      connectionName: string;
   *      edgeName: string;
   *      rangeBehaviors:
   *        {[call: string]: GraphQLMutatorConstants.RANGE_OPERATIONS};
   *    }
   *    where `parentName` is the field in the fatQuery that contains the range,
   *    `parentID` is the DataID of `parentName` in the store, `connectionName`
   *    is the name of the range, `edgeName` is the name of the key in server
   *    response that contains the newly created edge, `rangeBehaviors` maps
   *    stringified representation of calls on the connection to
   *    GraphQLMutatorConstants.RANGE_OPERATIONS.
   *
   * -  NODE_DELETE provides configuration for deleting a node and the
   *    corresponding edge from a range.
   *    {
   *      type: RelayMutationType.NODE_DELETE;
   *      parentName: string;
   *      parentID: string;
   *      connectionName: string;
   *      deletedIDFieldName: string;
   *    }
   *    where `parentName`, `parentID` and `connectionName` refer to the same
   *    things as in RANGE_ADD, `deletedIDFieldName` is the name of the key in
   *    the server response that contains the DataID of the deleted node.
   *
   * -  RANGE_DELETE provides configuration for deleting an edge from a range
   *    but doesn't delete the node.
   *    {
   *      type: RelayMutationType.RANGE_DELETE;
   *      parentName: string;
   *      parentID: string;
   *      connectionName: string;
   *      deletedIDFieldName: string;
   *      pathToConnection: Array<string>;
   *    }
   *    where `parentName`, `parentID`, `connectionName` and
   *    `deletedIDFieldName` refer to the same things as in NODE_DELETE,
   *    `pathToConnection` provides a path from `parentName` to
   *    `connectionName`.
   *
   * -  REQUIRED_CHILDREN is used to append additional children (fragments or
   *    fields) to the mutation query. Any data fetched as a result of these
   *    children is not written to the client store. Please avoid using this.
   *    {
   *      type: RelayMutationType.REQUIRED_CHILDREN;
   *      children: Array<RelayQuery.Node>;
   *    }
   */
  getConfigs(): Array<{[key: string]: mixed}> {
    invariant(
      false,
      '%s: Expected abstract method `getConfigs` to be implemented.',
      this.constructor.name
    );
  }

  /**
   * These variables form the "input" to the mutation query sent to the server.
   */
  getVariables(): {[name: string]: mixed} {
    invariant(
      false,
      '%s: Expected abstract method `getVariables` to be implemented.',
      this.constructor.name
    );
  }

  /**
   * These will be sent along with the mutation query to the server.
   */
  getFiles(): ?FileMap {
    return null;
  }

  /**
   * When a request is sent to the server, mutations can optionally construct an
   * optimistic response that has the same shape as the server response payload.
   * This optimistic response is used to pre-emptively update the client cache
   * to simulate an instantaneous response.
   *
   * The optimistic response may be a subset or superset of the actual response
   * payload. It can be a subset if certain fields are impossible to create on
   * the client (and if views are expected to handle the data inconsistency). It
   * can be a superset of the actual response payload if certain fields that are
   * affected have not been queried by the client, yet.
   */
  getOptimisticResponse(): ?{[key: string]: mixed} {
    return null;
  }

  /**
   * Optional. Similar to `getConfig`, this is used to create the query
   * corresponding to the `optimisticResponse`. If not provided, the query
   * will be inferred from the optimistic response. Most subclasses shouldn't
   * need to extend this method.
   */
  getOptimisticConfigs(): ?Array<{[key: string]: mixed}> {
    return null;
  }

  /**
   * An optional collision key allows a mutation to identify itself with other
   * mutations that affect the same fields. Mutations with the same collision
   * are sent to the server serially and in-order to avoid unpredictable and
   * potentially incorrect behavior.
   */
  getCollisionKey(): ?string {
    return null;
  }

  _resolveProps(props: Tp): void {
    var fragments = RelayDeprecated.getMutationFragments(this.constructor);
    var initialVariables =
      RelayDeprecated.getMutationInitialVariables(this.constructor) || {};

    var resolvedProps = {...props};
    forEachObject(fragments, (fragmentBuilder, fragmentName) => {
      var propValue = props[fragmentName];
      warning(
        propValue !== undefined,
        'RelayMutation: Expected data for fragment `%s` to be supplied to ' +
        '`%s` as a prop. Pass an explicit `null` if this is intentional.',
        fragmentName,
        this.constructor.name
      );

      if (!propValue) {
        return;
      }

      var fragment = fromGraphQL.Fragment(buildMutationFragment(
        this.constructor.name,
        fragmentName,
        fragmentBuilder,
        initialVariables
      ));
      var concreteFragmentID = fragment.getConcreteFragmentID();

      if (fragment.isPlural()) {
        invariant(
          Array.isArray(propValue),
          'RelayMutation: Invalid prop `%s` supplied to `%s`, expected an ' +
          'array of records because the corresponding fragment is plural.',
          fragmentName,
          this.constructor.name
        );
        var dataIDs = propValue.reduce((acc, item, ii) => {
          var eachFragmentPointer = item[concreteFragmentID];
          invariant(
            eachFragmentPointer,
            'RelayMutation: Invalid prop `%s` supplied to `%s`, ' +
            'expected element at index %s to have query data.',
            fragmentName,
            this.constructor.name,
            ii
          );
          return acc.concat(eachFragmentPointer.getDataIDs());
        }, []);

        resolvedProps[fragmentName] = RelayStore.readAll(fragment, dataIDs);
      } else {
        invariant(
          !Array.isArray(propValue),
          'RelayMutation: Invalid prop `%s` supplied to `%s`, expected a ' +
          'single record because the corresponding fragment is not plural.',
          fragmentName,
          this.constructor.name
        );
        var fragmentPointer = propValue[concreteFragmentID];
        if (fragmentPointer) {
          var dataID = fragmentPointer.getDataID();
          resolvedProps[fragmentName] = RelayStore.read(fragment, dataID);
        } else {
          if (__DEV__) {
            if (!this._didShowFakeDataWarning) {
              this._didShowFakeDataWarning = true;
              warning(
                false,
                'RelayMutation: Expected prop `%s` supplied to `%s` to ' +
                'be data fetched by Relay. This is likely an error unless ' +
                'you are purposely passing in mock data that conforms to ' +
                'the shape of this mutation\'s fragment.',
                fragmentName,
                this.constructor.name
              );
            }
          }
        }
      }
    });
    this.props = resolvedProps;
  }

  static getFragment(
    fragmentName: $Enum<Tp>,
    variableMapping?: Variables
  ): RelayFragmentReference {
    // TODO: Unify fragment API for containers and mutations, #7860172.
    var fragments = RelayDeprecated.getMutationFragments(this);
    var fragmentBuilder = fragments[fragmentName];
    if (!fragmentBuilder) {
      invariant(
        false,
        '%s.getFragment(): `%s` is not a valid fragment name. Available ' +
        'fragments names: %s',
        this.name,
        fragmentName,
        Object.keys(fragments).map(name => '`' + name + '`').join(', ')
      );
    }

    // $FlowFixMe - Deprecated APIs.
    var processQueryParams = this.processQueryParams;
    if (processQueryParams && !this.prepareVariables) {
      RelayDeprecated.warn({
        was: this.name + '.getQuery',
        now: this.name + '.getFragment',
      });
      this.prepareVariables =
        (prevVariables, route) => processQueryParams(route, prevVariables);
    }
    var initialVariables =
      RelayDeprecated.getMutationInitialVariables(this) || {};
    var prepareVariables = this.prepareVariables;

    return new RelayFragmentReference(
      () => buildMutationFragment(
        this.name,
        fragmentName,
        fragmentBuilder,
        initialVariables
      ),
      initialVariables,
      variableMapping,
      prepareVariables
    );
  }

  /**
   * @deprecated
   */
  static getQuery(): RelayFragmentReference {
    RelayDeprecated.warn({
      was: this.name + '.getQuery',
      now: this.name + '.getFragment',
    });
    return this.getFragment.apply(this, arguments);
  }
}

/**
 * Wrapper around `buildRQL.Fragment` with contextual error messages.
 */
function buildMutationFragment(
  mutationName: string,
  fragmentName: string,
  fragmentBuilder: FragmentBuilder,
  variables: Variables
): GraphQL.Fragment {
  var fragment = buildRQL.Fragment(
    fragmentBuilder,
    Object.keys(variables)
  );
  invariant(
    fragment,
    'Relay.QL defined on mutation `%s` named `%s` is not a valid fragment. ' +
    'A typical fragment is defined using: Relay.QL`fragment on Type {...}`',
    mutationName,
    fragmentName
  );
  return fragment;
}

module.exports = RelayMutation;
