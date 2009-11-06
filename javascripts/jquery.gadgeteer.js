/*! Copyright (c) 2009 Virgo Systems Kft. (http://virgo.hu)
 * Licensed under the MIT (http://www.opensource.org/licenses/mit-license.php)
 *
 * Version: 0.3.1
 * Requires opensocial-jQuery 1.0.4+
 *
 * @ypetya
 * Missing commits:
 *   fixing finalize 8d9963, parse json 63ed34, dontSwapdots 45c4c4
 *   ( we use the old way to get viewer and owner data )

// TODO:

// Step 0.
// =======

// Create gadget
// like this one... 

var Gadget = {
  frontendType: frontendType,
  host: backendHost,
  init: function() {},
  defaultTarget: '#page-gadgeteer',
  noAjaxForms: true,
  timeout: 5000,
  init_timeout: 1000,
  refresher_timeout: 10000,
  contentType: "text/html; charset=UTF-8",
  limit: topLimit,
  version: 'development 5.0'
}

// Step 1.
// =======

// Initialize your Gadgeteer at your like this:
// use default_options as an example at initialize...

$.gadgeteer.init({
  host: backendHost,
  loadingMessage: 'Az oldal tölt <span class="ellipses">…</span>',
  errorMessage: 'Hiba történt, kérjük frissítsd az oldalt <span class="ellipses">…</span>',
  submitSendingMessage: 'Küldés...',
  linkBehaviours: Gadget.linkBehaviours,
  dontAddOsParams: true,
  version: version,
  ajaxCache: false
});

// Step 2.
// =======

// Press play on tape...
// ( it will wait for document to load, and initializes loadingElement )

$.gadgeteer.start( Gadget.init );

// enjoy
*/


(function($) {

$.gadgeteer = function() {}

$.extend($.gadgeteer, {
 
    default_options: {
        // To disable link behavior override set this to true
        noAjaxLinks: false,
        // To disable auto ajaxize forms set this to true
        noAjaxForms: false,
        // This element is the default target of ajax calls
        defaultTarget: '#page',
        // You can specify the http_timeout in milliseconds for getData requests
        http_timeout: 5000,
        host: false,
        linkBehaviours: {},
        // if true, no automatic loading message shown on every ajax events
        noAutomaticLoadingMessage: false,
        // You can specify a full html loading element here... 
        customLoadingElement: false,
        // elseway this text will be formatted:
        loadingMessage: 'loading...',
        // Its the same as loading but it will shown only on error
        customErrorElement: false,
        errorMessage: 'Something went wrong! Please refresh!',
        // if this contains "development" -> sets up development mode: 
        // it will print out http error codes and enables debug
        version: 'unknown',
        // if this is true, we allow to cache ajax too
        ajaxCache: false,
        // if you set it up true, it will log to console. 
        // In development mode it will set this to true...
        debug: false
    },


    // initialize gadgeteer ...
    init: function(options) { $.gadgeteer.log('init', true);
        if($.gadgeteer.load_options(options)){

            if ( !$.gadgeteer.options.noAjaxLinks ){
                $.gadgeteer.init_link_behaviour();
            }

            if ( !$.gadgeteer.options.noAjaxForms )
                $.gadgeteer.init_ajax_forms();

            // Setup ajax event callbacks
            $.gadgeteer.setup_ajax_calls();

            return true;
        }
        else { 
            //options already loaded
            return false;
        }
    },


    // This will load options for first time
    load_options: function(options){ $.gadgeteer.log('load_options');
        // load options
        if ($.gadgeteer.options) 
            return false;
        else
            $.gadgeteer.options = options || $.gadgeteer.default_options;

        // load default options
        $.each($.gadgeteer.default_options, function( option, default_value){
          if( $.gadgeteer.options[option] === undefined )
            $.gadgeteer.options[option] = default_value;
        });

        // fill locals from options
        $.gadgeteer.defaultTarget = $.gadgeteer.options.defaultTarget;
        if($.gadgeteer.options.host)
            $.gadgeteer.host = $.gadgeteer.options.host;

        $.gadgeteer.linkBehaviours = $.gadgeteer.options.linkBehaviours;

        if($.gadgeteer.options.customLoadingElement)
            $.gadgeteer.LOADING_ELEM = $($.gadgeteer.options.customLoadingElement);
        if($.gadgeteer.options.customErrorElement)
            $.gadgeteer.ERROR_ELEM = $($.gadgeteer.options.customErrorElement);
        // in development mode: we need debug anyway
        if($.gadgeteer.is_development())
            $.gadgeteer.options.debug = true;

        return true;
    },


    start: function(callback) { $.gadgeteer.log('start');
        $.gadgeteer.get_owner_and_viewer_data();
        // Wait for everything to load then call the callback
        if($.isFunction(callback))
          $.gadgeteer.call_init_callback(callback);
    },


    init_link_behaviour: function() { $.gadgeteer.log('init_link_behaviour');
        $('a').livequery('click', function(e) {
            $.gadgeteer.handleLinkBehaviour.call($(this), e);
        }).removeAttr('onclick');
    },
  

    init_ajax_forms: function() { $.gadgeteer.log('init_ajax_forms');
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
                url: action.charAt(0) == '/' ? $.gadgeteer.host + action : action,
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

  
    call_init_callback: function(callback){ $.gadgeteer.log('call_init_callback');
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


    is_development: function(){ $.gadgeteer.log('is_development');
        if($.gadgeteer.options.version && $.gadgeteer.options.version.match('development')){
            return true;
        }
        return false;
    },


    // watch what we have done
    log: function(msg, force){
        // if we forced to log or settings say to log ...
        if( ( force || ( ! ($.gadgeteer.options === undefined) && $.gadgeteer.options.debug) ) 
                // and we have the option to log ...
                && !(console === undefined) && !(console.log === undefined) )
            // log
            console.log(' gadgeteer : ' + msg);
    },


    setup_ajax_calls: function(){ $.gadgeteer.log('setup_ajax_calls');
        var ajaxSetupParams = {};

        if( !$.gadgeteer.options.ajaxCache )
            ajaxSetupParams['cache'] = false;

        if( $.gadgeteer.defaultTarget )
            ajaxSetupParams['target'] = $.gadgeteer.defaultTarget;

        if( $.gadgeteer.http_timeout )
            ajaxSetupParams['timeout'] = $.gadgeteer.http_timeout;

        $.ajaxSetup(ajaxSetupParams);

        $(document).ajaxSend(function(e, request, settings) {
            $.gadgeteer.show_loading_message(settings.target, true);
        })
    
    
    .ajaxSuccess(function(e, request, settings) { $.gadgeteer.log('ajaxSuccess : ' + request.url );
        $.gadgeteer.currentUrl = request.url;

        if(settings.target) {
            var html = request.responseText;
            $(settings.target).html(html);
        }

        $.gadgeteer.fit_height();
    })

 
    .ajaxError(function(e, request, settings, exception) { $.gadgeteer.log('ajaxError');
        if( request.status === undefined || request.status.toString().charAt(0) == '5') 
            $.gadgeteer.show_error_message(settings.target);
        else {
            if (settings.target && request.status.toString().charAt(0) != '3') {
                var html = request.responseText;
                if( html != 'Error 0' ){
                    if($.gadgeteer.is_development())
                        jQuery(settings.target).html(html);
                    else
                        $.gadgeteer.show_error_message(settings.target);  
                }
                $.gadgeteer.fit_height();
            }
        }
    })


    .ajaxComplete(function(e, request, settings) { $.gadgeteer.log('ajaxComplete');
        $.gadgeteer.hide_loading_message();
            if( request.status === undefined ){ 
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
                    if (settings.auth == 'signed' || !$.gadgeteer.options.dontAddOsParams) 
                        params = $.param($.gadgeteer.viewer.osParams()) + '&' + $.param($.gadgeteer.owner.osParams());

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


    fit_height: function() { $.gadgeteer.log('fit_height');
        // !iframe
        $(window).adjustHeight();
        // Do another adjustHeight in 250ms just to be sure
        setTimeout(function() {$(window).adjustHeight();}, 250);
    },


    hide_loading_message: function(){ $.gadgeteer.log('hide_loading_message');
        if ($.gadgeteer.LOADING_ELEM) 
            $.gadgeteer.LOADING_ELEM.remove();
    },


    show_error_message: function(target){ $.gadgeteer.log('show_error_message');
        var the_target = target || $.gadgeteer.defaultTarget;

        $.gadgeteer.hide_loading_message();

        if($.gadgeteer.options.errorMessage) 
            $(the_target).append($.gadgeteer.errorElem());
    },


    show_loading_message: function(target, force){ $.gadgeteer.log('show_loading_message');
        var the_target = target || $.gadgeteer.defaultTarget;
        var e = $.gadgeteer.loadingElem();

        if( force || !$.gadgeteer.options.noAutomaticLoadingMessage)
            $(the_target).append(e);
    },


    call_opensocial: function(rest_command, params, callback){ $.gadgeteer.log('call_opensocial');
        // FIXME: when we have only 2 arguments...
        if( !$.isFunction(callback) ){
            callback = params;
            params = null;
        }

        // monitor the successed ajax event
        var error_timer = true;

        // if we don't get success in timeout then we do this...
        var create_timer = function(){
            return (function(){ 
                if(error_timer) $.gadgeteer.show_error_message();
            });
        }

        var the_timer = create_timer();

        // on success...
        var the_responder = function(data,status){
            error_timer = false;

            if( $.isFunction(callback) ) callback(data,status);

            $.gadgeteer.hide_loading_message();
        }

        setTimeout( the_timer, $.gadgeteer.options.http_timeout );

        if( params == null )
            $.getData(rest_command, the_responder );
        else
            $.getData(rest_command, params, the_responder );
        },


    get_owner_and_viewer_data: function(){ $.gadgeteer.log('get_owner_and_viewer_data');
        // Get information about the viewer and owner
        $.gadgeteer.call_opensocial('/people/@viewer/@self', function(data, status) {
            $.gadgeteer.viewer = data[0];
            $.gadgeteer.viewer.osParams = function() {return $.gadgeteer._osParams.call($.gadgeteer.viewer, 'viewer')};
        });
        $.gadgeteer.call_opensocial('/people/@owner/@self', function(data, status) {
            $.gadgeteer.owner = data[0];
            $.gadgeteer.owner.osParams = function() {return $.gadgeteer._osParams.call($.gadgeteer.owner, 'owner')};
        });
        $.gadgeteer.call_opensocial('/appdata/', function(data, status) {
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


    test_error: function(){ $.gadgeteer.log('test_error');
        $.gadgeteer.call_opensocial('/people_fail/@owner/@self', function(data, status) {
            $.gadgeteer.owner = data[0];
            $.gadgeteer.owner.osParams = function() {return $.gadgeteer._osParams.call($.gadgeteer.owner, 'owner')};
        });
    },


    _osParams: function(name) { $.gadgeteer.log('_osParams');
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
        if ($.gadgeteer.LOADING_ELEM) 
            return $.gadgeteer.LOADING_ELEM;

        var loading = $('#loading');
        if (loading.length < 1) 
            loading = $('<div id="loading">' + $.gadgeteer.options.loadingMessage + '</div>');

        return $.gadgeteer.LOADING_ELEM = loading;
    },


    errorElem: function() {
        if ($.gadgeteer.ERROR_ELEM) 
            return $.gadgeteer.ERROR_ELEM;

        var error = $('#error');
        if (error.length < 1)
            error = $('<div id="error">'+$.gadgeteer.options.errorMessage+'</div>');

        return $.gadgeteer.ERROR_ELEM = error;
    },


    expandUri: function(uri) {
        if (!$.gadgeteer.options.dontExpand) {
            if ($.gadgeteer.viewer)
                uri = uri.replace(/(?:(\/)|{)viewer(?:}|([\/\?#]|$))/g, '$1'+$.gadgeteer.viewer.id.replace(/\./g, '-')+'$2');

            if ($.gadgeteer.owner)
                uri = uri.replace(/(?:(\/)|{)owner(?:}|([\/\?#]|$))/g, '$1'+$.gadgeteer.owner.id.replace(/\./g, '-')+'$2');
        }
        return uri;
    },


    simpleRequest: function(href, options) { $.gadgeteer.log('simpleRequest');
        var params = {}
        if (options === undefined)
            options = {};
        if (options.addProfileIds){
            if (href.indexOf('os_viewer_id') == -1) 
                params.os_viewer_id = $.gadgeteer.viewer.id;
            if (href.indexOf('os_owner_id') == -1) 
                params.os_owner_id = $.gadgeteer.owner.id;
        }
        if (options.signed) 
            params = $.extend(false, params, $.gadgeteer.viewer.osParams(), $.gadgeteer.owner.osParams());

        href = $.gadgeteer.expandUri(href);
        options = $.extend(
            { // defaults
                type: 'GET',
                dataType: 'html'
            }, options, { // force options
                data: $.param(params),
                url: href.charAt(0) == '/' ? $.gadgeteer.host + href : href,
                oauth: options.signed && 'signed',
                target: options.target === undefined ? $($.gadgeteer.defaultTarget) : options.target
            }
        );
        $.ajax(options);
    },


    // regular request (i.e. normal anchor click through) is a no-op
    regularRequest: function(e) { },


    ajaxRequest: function(e) { $.gadgeteer.log('ajaxRequest');
        if (e !== undefined) {
            e.preventDefault();
        }

        var host = document.location.host;
        var link = $(this);
        var href = link.attr('href');
        var _href = link[0].getAttribute('href');

        //hack for IE href attr bug
        if (_href.match(host)) {
            var l = _href.search(host)+host.length;
            href = _href.substring(l);
        }

        if (href.charAt(0) == '/') 
            href = $.gadgeteer.host + href;

        var params = {};
        var method = link.hasClass('post') ? 'post' : link.hasClass('put') ? 'put' : link.hasClass('delete') ? 'delete' : 'get';
        if (method != 'get') 
            params._method = method;
        if (link.hasClass('signed'))
            params = $.extend(false, params, $.gadgeteer.viewer.osParams(), $.gadgeteer.owner.osParams());
        else if (!$.gadgeteer.options.dontAddOsParams)
            params = $.extend(false, params, {os_viewer_id: $.gadgeteer.viewer.id, os_owner_id: $.gadgeteer.owner.id});


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


    navigateRequest: function(view, params, ownerId, e) { $.gadgeteer.log('navigateRequest');
        if (e !== undefined)
            e.preventDefault();

        view = gadgets.views.getSupportedViews()[view];
        gadgets.views.requestNavigateTo(view, params, ownerId); 
    },


    handleLinkBehaviour: function(e) { $.gadgeteer.log('handleLinkBehaviour');
        var link = $(this);
        var matched = false;
        $.each($.gadgeteer.linkBehaviours, function(behaviour, callback) {
            var match;
            if ($.isFunction(callback) && (match = callback.call(link, e))) {
                var params = match === true ? [] : ($.isFunction(match.push) ? match : Array(match));
                params.push(e);
                $.gadgeteer.log('calling ', behaviour, ' link behaviour for ', link, ' with ', params);
                var handler = behaviour+'Request';
                handler = $.gadgeteer.linkBehaviours.handlers && $.gadgeteer.linkBehaviours.handlers[handler] || $.gadgeteer[handler];
                handler.apply(link, params);
                matched = true;
                return false;
            }
        });
        if (!matched) {
            var def = $.gadgeteer.linkBehaviours.defaultBehavior || 'ajax';
            $.gadgeteer.log('calling DEFAULT ', def, ' link behaviour for ', link, ' with ', e);
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
