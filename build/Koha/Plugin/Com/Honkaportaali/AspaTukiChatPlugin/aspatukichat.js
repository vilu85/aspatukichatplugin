var payload;
var lastTimestamp;
var prog;
var error;
var motd;
var useNode = true;

//---- Listeners and custom menu item(s) ----//

//// Focus chat inputbox when the chat is opened
//$('#chatmodal').on('shown.bs.modal', function () {
//  $('#txtMessage').focus();
//});

// Add chat button
$('#i18nMenu').after('<ul class="nav nav-tabs navbar-nav navbar navbar-right"> \
    <li><button class="btn btn-primary dropdown-toggle dropdown" type="button" data-target="#chatmodal" data-toggle="modal">Support&nbsp;<span id="unreadMsgs" class="badge"></span><span class="caret"></span></button> \
</li></ul>');

//---- Main loop ----//
//$(function() {
//    asyncGetMessages();
//});

//---- Functions ----//

function send_and_show( message, userdata, sub, callback ) {
  showLoading( message );
  send_data( userdata, sub, function() {
    hideLoading();
    callback();
  });
}

function send_data( userdata, sub, callback ) {
    var data = {};
    data.userdata = JSON.stringify(userdata);
    data.class = "Koha::Plugin::Com::Honkaportaali::AspaTukiChatPlugin";
    data.method = "tool";
    data.sub = sub;

    $.ajax({ 
        type: "POST",
        url: "/cgi-bin/koha/plugins/run.pl",
        data: data,
        success: callback,
        dataType: "json"
    });
}

// Focus chat inputbox and create cookie to keep chat open when the the chat is opened
$('#chatmodal').on('shown.bs.modal', function () {
  $.cookie("isChatOpen", 1);
  $('#txtMessage').focus();
});
// Remove isChatOpen-cookie
$('#chatmodal').on('hidden.bs.modal', function () {
  $.removeCookie("isChatOpen");
});

$.getScript('/plugin/Koha/Plugin/Com/Honkaportaali/AspaTukiChatPlugin/pageslide/jquery.pageslide.min.js', function() {
  if( useNode ) {
    $.get("/chat/index.html", function(html){
      $('#changelanguage').before(html);
      
      $( document ).ready(function() {
        // Focus chat inputbox and create cookie to keep chat open when the the chat is opened
        $('#chatmodal').on('shown.bs.modal', function () {
          $.cookie("isChatOpen", 1);
          $('#txtMessage').focus();
        });
        
        // Remove isChatOpen-cookie
        $('#chatmodal').on('hidden.bs.modal', function () {
          $.removeCookie("isChatOpen");
        });

        // Bind send button
        $('#chat_page_submit').click( handle_chat_submit );
      
        // Handle submit when the enter key is pressed
        $('#txtMessage').keypress(function(event){
            var keycode = (event.keyCode ? event.keyCode : event.which);
            if(keycode == '13'){
                handle_chat_submit();
            }
            //Stop the event from propogation to other handlers
            //If this line will be removed, then keypress event handler attached 
            //at document level will also be triggered
            event.stopPropagation();
        });
        
        payload = {
            "username":     $(".loggedinusername").html()
        };
        
        if($.cookie("isChatOpen") == 1) {
          $("#chatmodal").modal();
        }
      });
  });
  } else {
    $.get("/plugin/Koha/Plugin/Com/Honkaportaali/AspaTukiChatPlugin/chat2.html", function(html){
      $('#changelanguage').before(html);
      
      $( document ).ready(function() {
        // Focus chat inputbox and create cookie to keep chat open when the the chat is opened
        $('#chatmodal').on('shown.bs.modal', function () {
          $.cookie("isChatOpen", 1);
          $('#txtMessage').focus();
        });
        
        // Remove isChatOpen-cookie
        $('#chatmodal').on('hidden.bs.modal', function () {
          $.removeCookie("isChatOpen");
        });

        // Bind send button
        $('#chat_page_submit').click( handle_chat_submit );
      
        // Handle submit when the enter key is pressed
        $('#txtMessage').keypress(function(event){
            var keycode = (event.keyCode ? event.keyCode : event.which);
            if(keycode == '13'){
                handle_chat_submit();
            }
            //Stop the event from propogation to other handlers
            //If this line will be removed, then keypress event handler attached 
            //at document level will also be triggered
            event.stopPropagation();
        });
        
        payload = {
            "username":     $(".loggedinusername").html()
        };
        
        if($.cookie("isChatOpen") == 1) {
          $("#chatmodal").modal();
        }

        //send_and_show( "Logging in", payload, "login", onLogin );
        showLoading( "Logging in" );
        send_data( payload, "login", onLogin );
      });
  });
  }
});

function onLogin( data ) {
  if(data.status == "authok") {
    payload = {
        "username":     $(".loggedinusername").html()
    };
    $.cookie("chatUser", payload.username);
    showLoading( "Opening chat" );
    motd = data.data;
    send_data( payload, "get_initial_data", onInitialDataReceived );
  } else {
    hideLoading();
    
    console.log("AspaTukiChat logon failed: " + data);
    $.removeCookie("chatUser");
    
    if(data.status == "offline") {
      var offlineHtml = '<div id="offline" class="text-error">\
        <h4>Chat system is offline</h4>\
        <p>' + data.data + '</p>\
      </div>';
      $('#loadingAnim').after(offlineHtml);
    }
    
    if(data.status == "authfail") {
      var authfailHtml = '<div id="offline" class="text-error">\
        <h4>Login failed</h4>\
        <p>This may be because</p>\
        <ul>\
          <li>Your credentials were not accepted</li>\
          <li>You don\'t have sufficient rights to access this module</li>\
        </ul>\
      </div>';
      $('#loadingAnim').after(authfailHtml);
    }
  }
}

function onInitialDataReceived ( data ) {
    hideLoading();
    payload = data;
    lastTimestamp = data.timestamp;
    if(data.messagesjson) {
        lastTimestamp = data.timestamp;
        //$('.chat_main').html(data.messages);
        data.messagesjson.forEach( handleMessage );
    }
    
    if(motd != '') {
      var motdHtml = '<p>' + motd + '</p>';
      $('#chatmessages').append(motdHtml);
    }
    
    asyncGetMessages();
}

function asyncGetMessages() {
    payload = {
        "username":     $(".loggedinusername").html(), 
        "timestamp":    lastTimestamp
    };
    
    send_data(payload, "get_last_messages", function(data) {
        if(data.messagesjson) {
            lastTimestamp = data.timestamp;
            $.cookie("chatTimestamp", data.timestamp);
            $.cookie("chatMessages", data.messagesjson);
            //$('.chat_main').html(data.messages);
            data.messagesjson.forEach( handleMessage );
        }

        // start it again;
        asyncGetMessages();
    });
}

function handleMessage(item, index, arr) {
  if(item.isOwn) {
    addNewMessage(item.id, item.content, item.timestamp, item.diff);
  } else {
    addNewMessageFrom(item.id, item.from, item.content, item.timestamp, item.diff);
  }
  $("#chatmessages").scrollTop(9999);
}

function addNewMessageFrom( id, from, content, timestamp, diff ) {
  var extraStyle = getExtraStyle(diff);
  var extraJs = getExtraJs(id, diff);
  var newMessage = '<div class="media w-100 mb-3" id="message_' + id + '" ' + extraStyle + '> \
    <div class="media-left"><a><img class="img-circle media-object" src="https://res.cloudinary.com/mhmd/image/upload/v1564960395/avatar_usae7z.svg" width="50px" /><p class="media-object text-center text-muted">' + from + '</p></a></div> \
    <div class="media-body"> \
        <div class="bg-light shadow-sm rounded px-3 mb-1 padding-6"> \
            <p>' + content + '</p> \
        </div> \
        <p class="text-muted mx-8">' + timeConverter(timestamp) + '</p> \
    </div> \
</div>' + extraJs;
  
  $('#chatmessages').append(newMessage);
}

function addNewMessage( id, content, timestamp, diff ) {
  var extraStyle = getExtraStyle(diff);
  var extraJs = getExtraJs(id, diff);
  var newOtherMessage = '<div class="media w-100 ml-auto mb-3" id="message_' + id + '" ' + extraStyle + '> \
                        <div class="media-body"> \
                            <div class="bg-primary shadow rounded"> \
                                <p class="mb-0 text-white padding-6">' + content + '</p> \
                            </div> \
                            <p class="text-muted">' + timeConverter(timestamp) + '</p> \
                        </div> \
                    </div>' + extraJs;
  
  $('#chatmessages').append(newOtherMessage);
}

function getExtraStyle(diff) {
  if(diff < 7) {
    return 'style="display:none;"';
  } else {
    return '';
  }
}

function getExtraJs(id, diff) {
  if(diff < 7) {
    return "<script>$('#message_" + id + "').slideToggle('slow');</script>";
  } else {
    return "";
  }
}

/* Chat page workflow */
function handle_chat_submit() {
    payload.username = $(".loggedinusername").html();
    payload.message  = $("#txtMessage").val();
    $("#txtMessage").val("");
    if (payload.message != null && payload.message.trim() != "") {
        send_data( payload, "new_message", onMessageSent );
        $('#txtMessage').focus();
    }
}

function onMessageSent( data ) {
    if(data.success == 2 && data.messagesjson) {
        console.log("onMessageSent success");
    } else {
        console.log("onMessageSent failed: ");
        console.log(data.success);
        console.log(data.messagesjson);
    }
}

function showLoading(msg) {
    $('#loadingMsg').html(msg + "...");
    $('#loadingAnim').show();
}

function hideLoading() {
  $('#loadingAnim').hide();
}

function updateUnreadMsgs( count ) {
  $('#unreadMsgs').text(count);
}

function timeConverter(t) {     
    var a = new Date(t * 1000);
    var today = new Date();
    var yesterday = new Date(Date.now() - 86400000);
    var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    var year = a.getFullYear();
    var month = months[a.getMonth()];
    var date = a.getDate();
    var hour = a.getHours();
    var min = a.getMinutes();
    if (a.setHours(0,0,0,0) == today.setHours(0,0,0,0))
        return 'today, ' + hour + ':' + min;
    else if (a.setHours(0,0,0,0) == yesterday.setHours(0,0,0,0))
        return 'yesterday, ' + hour + ':' + min;
    else if (year == today.getFullYear())
        return date + ' ' + month + ', ' + hour + ':' + min;
    else
        return date + ' ' + month + ' ' + year + ', ' + hour + ':' + min;
}