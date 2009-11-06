/*! Copyright (c) 2009 Virgo Systems Kft. (http://virgo.hu)
 * Licensed under the MIT (http://www.opensource.org/licenses/mit-license.php)
 *
 * Version: 0.3
 * Requires opensocial-jQuery 1.0.4+
 */

(function($) {

$.gadgeteer = function() {}

$.extend($.gadgeteer, {
  
  init: function(options) {

    if ($.gadgeteer.options) 
      return false;
    else
      $.gadgeteer.options = options = options || {};

    $.gadgeteer.defaultTarget = options.defaultTarget || '#page';
    $.gadgeteer.host = options.host || '';
    $.gadgeteer.linkBehaviours = options.linkBehaviours || {};

    if( $.gadgeteer.options ) {
      if ( ! $.gadgeteer.options.noAjaxLinks ) {
        $.gadgeteer.init_link_behaviour();
      }

      // Setup ajax forms
      if ( ! $.gadgeteer.options.noAjaxForms ) {
        $.gadgeteer.init_ajax_forms();
      }
    }

    // Setup ajax event callbacks
    $.gadgeteer.setup_ajax_calls();
  },

  start: function(callback) {
    $.gadgeteer.get_owner_and_viewer_data();
    // Wait for everything to load then call the callback
    if($.isFunction(callback))
      $.gadgeteer.call_init_callback(callback);
  },

  init_link_behaviour: function() {
    $('a').livequery('click', function(e) {
      $.gadgeteer.handleLinkBehaviour.call($(this), e);
    }).removeAttr('onclick');
  },
  

  init_ajax_forms: function() {
      // Making sure submit input element values are submitted
      $('form input[type=submit]').livequery('click', function(e) {
        $(this).parents('form:eq(0)').data('submitClicked', $(this));
      });
      // All forms will submit through an ajax call
      $('form').livequery('submit', function(e) {
        e.preventDefault();
        var form = $(this);
        var action = form.attr('action');
        var target = form.hasClass('silent') ? null : $.gadgeteer.defaultTarget;
        var params = [$.param(form.formToArray()), $.param($.gadgeteer.viewer.osParams()), $.param($.gadgeteer.owner.osParams())];
        var submit = form.data('submitClicked');
        if (submit) {
          if (submit.attr('name')) {
            var param = {};
            param[submit.attr('name')] = submit.val();
            params.push($.param(param));
          }
          if ($.gadgeteer.options.submitSendingMessage) {
            submit.data('oldValue', submit.val());
            submit.val($.gadgeteer.options.submitSendingMessage).get(0).disabled = true;
          }
          form.data('submitClicked', null);
        }
        action = $.gadgeteer.expandUri(action);
        $.ajax({
          url: action,
          type: form.attr('method') || 'GET',
          data: params.join("&"),
          dataType: 'html',
          oauth: 'signed',
          target: target,
          complete: function(request, status) {
            if (submit) {
              var oldValue = submit.data('oldValue');
              if (oldValue) {
                submit.val(oldValue).get(0).disabled = false;
                submit.data('oldValue', null);
              }
            }
          }
        });
      });
  },
  
  call_init_callback: function(callback){
    setTimeout(function() {
      if ($.gadgeteer.viewer && $.gadgeteer.owner && $.gadgeteer.data) {
        // Navigate away if params tell so
        var params = gadgets.views.getParams();
        var navTo = params.navigateTo;
        if (navTo) {
          // Tell the callback that we're navigating away
          callback(true);
          $.gadgeteer.simpleRequest(navTo, {signed: params.signedNavigate});
        } else {
          callback();
        }
      } else {
        setTimeout(arguments.callee, 50);
      }
    }, 50);
  },

  setup_ajax_calls: function(){
    $(document).ajaxSend(function(e, request, settings) {
      if (settings.target && $.gadgeteer.options.loadingMessage) {
        $(settings.target).append($.gadgeteer.loadingElem());
      }
    })
    
    
    .ajaxSuccess(function(e, request, settings) {
      $.gadgeteer.currentUrl = request.url;
      if (settings.target) {
        var html = request.responseText;
        $(settings.target).html(html);
      }
      // !iframe
      $(window).adjustHeight();
      // Do another adjustHeight in 250ms just to be sure
      setTimeout(function() {$(window).adjustHeight();}, 250);
    })
    
    
    .ajaxError(function(e, request, settings, exception) {
      if( typeof(request.status) == 'undefined' || request.status.toString().charAt(0) == '5'){ 
        //timeout error
        if(settings.target) {
          if ($.gadgeteer.LOADING_ELEM) $.gadgeteer.LOADING_ELEM.remove();
          if($.gadgeteer.options.errorMessage) $(settings.target).append($.gadgeteer.errorElem());
        }
      }
      else
      {
        if (settings.target && request.status.toString().charAt(0) != '3') {
          var html = request.responseText;
          if( html != 'Error 0' ){
            jQuery(settings.target).html(html);
          }
          // !iframe
          $(window).adjustHeight();
          // Do another adjustHeight in 250ms just to be sure
          setTimeout(function() {$(window).adjustHeight();}, 250);
        }
      }
    })


    .ajaxComplete(function(e, request, settings) {
      if( typeof(request.status) == 'undefined' ){ 
        //timeout error
        //nothing to do...
      }
      else {
        if (request.status.toString().charAt(0) == '3') {
          // 3XX status codes -> retry
          var href = request.getResponseHeader('Location') || request.getResponseHeader('location');
          // hackish way to determine if we have an array (depends on the fact that the real href must be longer than 1 char)
          if (!href.charAt) href = href[0];
          href = $.gadgeteer.expandUri(href);
          var params = '';
          if (settings.auth == 'signed' || !$.gadgeteer.options.dontAddOsParams) {
            params = $.param($.gadgeteer.viewer.osParams()) + '&' + $.param($.gadgeteer.owner.osParams())
          }
          $.ajax({
            url: href.charAt(0) == '/' ? $.gadgeteer.host + href : href,
            type: 'GET',
            data: params,
            dataType: 'html',
            oauth: settings.auth,
            target: settings.target
          });
        }
      }
    });
  },

  get_owner_and_viewer_data: function(){
    // Get information about the viewer and owner
    $.getData('/people/@viewer/@self', function(data, status) {
      $.gadgeteer.viewer = data[0];
      $.gadgeteer.viewer.osParams = function() {return $.gadgeteer._osParams.call($.gadgeteer.viewer, 'viewer')};
    });
    $.getData('/people/@owner/@self', function(data, status) {
      $.gadgeteer.owner = data[0];
      $.gadgeteer.owner.osParams = function() {return $.gadgeteer._osParams.call($.gadgeteer.owner, 'owner')};
    });
    $.getData('/appdata/', function(data, status) {
      for (var id in data) {
        data = data[id];
        break;
      }
      $.gadgeteer.data = function(key, value) {
        if (value === undefined) {
          return data[key];
        } else {
          data[key] = value;
          var params = {};
          params[key] = value;
          $.postData('/appdata/', params);
          return value;
        }
      };
    });
  },

  _osParams: function(name) {
    var params = {};
    for (var attr in this) {
      if (!$.isFunction(this[attr])) {
        var underscore = attr.replace(/([A-Z])/, '_$1').toLowerCase();
        params['os_'+name+'_'+underscore] = this[attr];
      }
    }
    return params;
  },

  loadingElem: function() {
    if ($.gadgeteer.LOADING_ELEM) return $.gadgeteer.LOADING_ELEM;

    var loading = $('#loading');
    if (loading.length < 1) {
      loading = $('<div id="loading">'+$.gadgeteer.options.loadingMessage+'</div>');
    }
    return $.gadgeteer.LOADING_ELEM = loading;
  },

  errorElem: function() {
    if ($.gadgeteer.ERROR_ELEM) return $.gadgeteer.ERROR_ELEM;

    var error = $('#error');
    if (error.length < 1) {
      error = $('<div id="error">'+$.gadgeteer.options.errorMessage+'</div>');
    }
    return $.gadgeteer.ERROR_ELEM = error;
  },

  expandUri: function(uri) {
    if (!$.gadgeteer.options.dontExpand) {
      if ($.gadgeteer.viewer) {
        uri = uri.replace(/(?:(\/)|{)viewer(?:}|([\/\?#]|$))/g, '$1'+$.gadgeteer.viewer.backendId+'$2');
      }
      if ($.gadgeteer.owner) {
        uri = uri.replace(/(?:(\/)|{)owner(?:}|([\/\?#]|$))/g, '$1'+$.gadgeteer.owner.backendId+'$2');
      }
    }
    if (options.addParams) {
      var params = $.param($.extend(false, $.gadgeteer.viewer.osParams(), $.gadgeteer.owner.osParams()));
      uri += (uri.indexOf('?') != -1 ? '&' : '?') + params;
    } else if (options.addProfileIds) {
      var params = {};
      if (uri.indexOf('os_viewer_id') == -1) params.os_viewer_id = $.gadgeteer.viewer.id;
      if (uri.indexOf('os_owner_id') == -1) params.os_owner_id = $.gadgeteer.owner.id;
      uri += (uri.indexOf('?') != -1 ? '&' : '?') + $.param(params);
    }
    return uri;
  },

  simpleRequest: function(href, options) {
    var params = {}
    if (options === undefined) options = {};
    if (options.addProfileIds) {
      if (href.indexOf('os_viewer_id') == -1) params.os_viewer_id = $.gadgeteer.viewer.id;
      if (href.indexOf('os_owner_id') == -1) params.os_owner_id = $.gadgeteer.owner.id;
    }
    if (options.signed) {
      params = $.extend(false, params, $.gadgeteer.viewer.osParams(), $.gadgeteer.owner.osParams());
    }
    href = $.gadgeteer.expandUri(href);
    options = $.extend(
      { // defaults
        type: 'GET',
        dataType: 'html'
      }, options, { // force options
        data: $.param(params),
        url: href,
        oauth: options.signed && 'signed',
        target: options.target === undefined ? $($.gadgeteer.defaultTarget) : options.target
      }
    );
    $.ajax(options);
  },

  regularRequest: function(e) {
    // regular request (i.e. normal anchor click through) is a no-op
  },

  ajaxRequest: function(e) {
    e.preventDefault();
    var host = document.location.host;
    var link = $(this);
    var href = link.attr('href');
    var _href = link[0].getAttribute('href');

    //hack for IE href attr bug
    if (_href.match(host)) {
      var l = _href.search(host)+host.length;
      href = _href.substring(l);
    }

    var params = {};
    var method = link.hasClass('post') ? 'post' : link.hasClass('put') ? 'put' : link.hasClass('delete') ? 'delete' : 'get';
    if (method != 'get') params._method = method;
    if (link.hasClass('signed')) {
      params = $.extend(false, params, $.gadgeteer.viewer.osParams(), $.gadgeteer.owner.osParams());
    } else if (!$.gadgeteer.options.dontAddOsParams) {
      params = $.extend(false, params, {os_viewer_id: $.gadgeteer.viewer.id, os_owner_id: $.gadgeteer.owner.id});
    }

    var target = link.hasClass('silent') ? null : $.gadgeteer.defaultTarget;
    href = $.gadgeteer.expandUri(href);
    $.ajax({
      type: method == 'get' ? 'GET' : 'POST',
      url: href,
      data: params,
      dataType: target ? 'html' : null,
      oauth: link.hasClass('signed') ? 'signed' : null,
      target: target
    });
  },

  navigateRequest: function(view, params, ownerId, e) {
    if (e !== undefined) {
      e.preventDefault();
    }
    view = gadgets.views.getSupportedViews()[view];
    gadgets.views.requestNavigateTo(view, params, ownerId); 
  },

  handleLinkBehaviour: function(e) {
    var link = $(this);
    var matched = false;
    $.each($.gadgeteer.linkBehaviours, function(behaviour, callback) {
      var match;
      if ($.isFunction(callback) && (match = callback.call(link, e))) {
        var params = match === true ? [] : ($.isFunction(match.push) ? match : Array(match));
        params.push(e);
        //console.log('calling ', behaviour, ' link behaviour for ', link, ' with ', params);
        var handler = behaviour+'Request';
        handler = $.gadgeteer.linkBehaviours.handlers && $.gadgeteer.linkBehaviours.handlers[handler] || $.gadgeteer[handler];
        handler.apply(link, params);
        matched = true;
        return false;
      }
    });
    if (!matched) {
     var def = $.gadgeteer.linkBehaviours.defaultBehavior || 'ajax';
     //console.log('calling DEFAULT ', def, ' link behaviour for ', link, ' with ', e);
     $.gadgeteer[def+'Request'].call(link, e);
    }
  },

  appLink: function(parameters) {
    return gadgets.views.bind(gadgets.config.get('views')['canvas'].urlTemplate, {
      appId: document.location.host.match(/(\d+)\./)[1],
      viewParams: encodeURIComponent(gadgets.json.stringify(parameters))
    });
  }
});

// Initialize gadgeteer
$($.gadgeteer);

if (typeof $g == "undefined") {
  $g = $.gadgeteer;
}

})(jQuery);
