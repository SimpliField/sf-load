// The following consts are object masks defining
// various states that will bet set on the given scope
const DEFAULT_VALUES = {
  activating: false, // Wether the content is loading for the first time
  activated: false, // Wether the content were set once
  loading: true, // The content is currently loading
  reloading: false, // The content is currently loading and were loaded once before
  loaded: false, // The content were loaded succesfully
  failed: null, // Couldn't load the content
};

const LOAD_VALUES = {
  // activating: dynamically computed
  // activated: not modified
  loading: true,
  // reloading: dynamically computed
  loaded: false,
  // failed: dynamically computed
};

const SUCCESS_VALUES = {
  activating: false,
  activated: true,
  loading: false,
  reloading: false,
  loaded: true,
  failed: null,
};

const FAIL_VALUES = {
  activating: false,
  // activated: not modified
  loading: false,
  reloading: false,
  loaded: false,
  // failed: dynamically get the error on fail
};

LoadService.$inject = [
  '$q', '$log',
];

function LoadService($q, $log) {
  return {
    runState: runCustomState.bind(null, 'actions'),
    runCustomState: runCustomState,
    loadState: loadCustomState.bind(null, 'states'),
    loadCustomState: loadCustomState,
    wrapHTTPCall: wrapHTTPCall,
  };

  //
  function runCustomState(prop, scope, name, promise) {
    return _manageLoadWorkflow(promise, scope, prop, name);
  }

  function loadCustomState(prop, scope, promises) {
    let newPromises = {};

    // Manage scope indicators for all the resources
    _manageLoadWorkflow($q.all(promises), scope, prop, '_all')
      // Here we catch _all errors to avoid unhandled reject warnings
      .catch((err) => { $log.error(err); });

    // Manage individual resources scope indicators
    Object.keys(promises).forEach(function(key) {
      newPromises[key] = _manageLoadWorkflow(promises[key], scope, prop, key);
    });

    return newPromises;
  }

  function _manageLoadWorkflow(promise, scope, prop, key) {
    // Set initial load state
    _softlySetKey(scope, prop, key, LOAD_VALUES, {
      activating: !(scope[prop] && scope[prop][key] && scope[prop][key].activated),
      reloading: !!(scope[prop] && scope[prop][key] && scope[prop][key].activated),
    });
    // Handle success
    return promise.then(function(data) {
      $log.debug('Successful load:', scope, prop, key);
      _softlySetKey(scope, prop, key, SUCCESS_VALUES);
      return data;
    // Catch error and cast it
    }).catch(function(err) {
      $log.debug('Failed load:', scope, prop, key, err);
      _softlySetKey(scope, prop, key, FAIL_VALUES, {
        failed: err,
      });
      throw err;
    });
  }

  function _softlySetKey(scope, prop, key, ...values) {
    // Ensure the prop is alright
    scope[prop] = scope[prop] || {};
    // Properly init the key if no set
    scope[prop][key] = scope[prop][key] ||
      Object.keys(DEFAULT_VALUES).reduce((newObject, key) => {
        newObject[key] = DEFAULT_VALUES[key];
        return newObject;
      }, {});
    // Carefully apply values
    values.forEach(function(value) {
      Object.keys(value).forEach(function(valueKey) {
        scope[prop][key][valueKey] = value[valueKey];
      });
    });
  }

  function wrapHTTPCall(promise, expectedStatus) {
    return promise
    .catch(function(response) {
      let err;

      if(response.status !== expectedStatus) {
        if(0 >= response.status) {
          err = new Error('E_NETWORK');
          err.code = 'E_NETWORK';
          throw err;
        }
      }
      return response;
    })
    .then(function(response) {
      let err;

      if(response.status !== expectedStatus) {
        err = new Error(response.data.code || 'E_UNEXPECTED');
        err.code = response.data.code || 'E_UNEXPECTED';
        throw err;
      }

      return response;
    });
  }
}

export { LoadService };
