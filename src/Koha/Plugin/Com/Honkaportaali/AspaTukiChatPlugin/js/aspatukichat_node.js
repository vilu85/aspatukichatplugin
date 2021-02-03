var payload;
var lastTimestamp;
var prog;
var error;
var motd, pluginVersion;
var isChatVisible = false;
var screenshot;
class cachedMessage {
  constructor(userIn, contentIn, timeIn, imageIn = undefined) {
    this.user = userIn;
    this.content = contentIn;
    this.time = timeIn;
    this.image = imageIn;
  }

  getData() {
    var data = {
      'username' : this.user,
      'message' : this.content,
      'time' : this.time,
      'image' : (this.image || undefined)
    };

    return data;
  }
}

$.get("/plugin/Koha/Plugin/Com/Honkaportaali/AspaTukiChatPlugin/nodechat.html", function (html) {
  $('#changelanguage').before(html);

  $(document).ready(function () {
    $(function () {
      var FADE_TIME = 150; // ms
      var TYPING_TIMER_LENGTH = 400; // ms
      var COLORS = [
        '#e21400', '#91580f', '#f8a700', '#f78b00',
        '#58dc00', '#287b00', '#a8f07a', '#4ae8c4',
        '#3b88eb', '#3824aa', '#a700ff', '#d300e7'
      ];
      var MAX_HEIGHT = 300;

      // Initialize variables
      var $window = $(window);
      var $usernameInput = $(".loggedinusername").html(); //$('.usernameInput'); // Input for username
      var $messages = $('.chat-box'); // Messages area
      var $screenshotPreviewPanel = $('#screenshotPreviewPanel');
      var $inputMessage = $('#txtMessage'); //$('.inputMessage'); // Input message input box

      var $loginPage = $('.login.page'); // The login page
      var $chatPage = $('.chat.page'); // The chatroom page

      const inboxPeople = document.querySelector("#chatusers"); // User list
      var $userlist = $('#chatusers');
      const chatModal = $('#chatmodal'); // Chat modal
      var $btnScreenshot = $('#btnScreenshot'); // Screenshot capture button
      var $btnDeleteImage = $('#btnDeleteImage'); // Delete screenshot button
      var $imgviewermodal = $('#imgViewerModal'); // Modal for viewing images on fullscreen
      var screenshot; // Variable where the last screenshot is saved

      // Prompt for setting a username
      var username = $(".loggedinusername").html();
      var connected = false;
      var typing = false;
      var lastTypingTime;
      var $currentInput;// = $usernameInput.focus();
      var unreadMsgs = 0;

      const generateHash = (len) => {
        var symbols = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890';
        var hash = '';
        for (var i = 0; i < len; i++) {
          var symIndex = Math.floor(Math.random() * symbols.length);
          hash += symbols.charAt(symIndex);
        }
        return hash;
      };

      // Add chat button
      $('#i18nMenu').after('<ul class="nav nav-tabs navbar-nav navbar navbar-right"> \
        <li><button id="chatBtn" class="btn" type="button"><i class="fa fa-comments"></i><span id="unreadMsgs" class="badge"></span></button> \
        </li></ul>');

      // Initialize socket in v1.0
      //var socket = io.connect('http://lainaamo-intra.ouka.fi', {
      //  'path': '/chat/socket.io'
      //});
      var socket = io();

      // Create usermap
      var users = new Set();

      const addToUsersBox = (data) => {
        var $alreadyAddedUsers = getAlreadyAddedUsers(data);
        if ($alreadyAddedUsers.length !== 0) {
          $alreadyAddedUsers.remove();
        }
        
        var $userentry = $('<li class="userentry list-group-item">')
              .data('username', data.username)
              .text(data.username);
        $userlist.append($userentry);
      };

      const getAlreadyAddedUsers = (data) => {
        return $('.userentry').filter(function (i) {
          return $(this).data('username') === data.username;
        });
      };

      const removeFromUsersBox = (data) => {
        getAlreadyAddedUsers(data).fadeOut(function () {
          $(this).remove();
        });
      };

      const addParticipantsMessage = (data) => {
        var message = '';
        if (data.numUsers === 1) {
          message += "Keskustelussa on 1 osallistuja";
        } else {
          message += "Keskustelussa on  " + data.numUsers + " osallistujaa";
        }
        log(message);
      };

      // Sets the client's username
      const setUsername = () => {
        username = cleanInput($usernameInput.trim());

        // If the username is valid
        if (username) {
          $loginPage.fadeOut();
          $chatPage.show();
          $loginPage.off('click');
          $currentInput = $inputMessage.focus();
          // Check and generate userid cookie if needed
          // TODO: Implement this: https://stackoverflow.com/questions/22594897/socket-io-disconnects-when-refreshed
          if (!/\buser_id=/.test(document.cookie)) { //if no 'user_id' in cookies
            document.cookie = 'user_id=' + generateHash(32);  //add cookie 'user_id'
          }
          // Tell the server your username
          socket.emit('add user', username);
        }
      };

      // Sends a chat message
      const sendMessage = () => {
        var message = $inputMessage.val();
        // Prevent markup from being injected into the message
        message = cleanInput(message);
        // if there is a non-empty message and a socket connection
        if (message && connected) {
          $inputMessage.val('');
          addChatMessage({
            username: username,
            message: message,
            image: (screenshot !== undefined ? screenshot : undefined)
          });

          if(screenshot !== undefined) {
            var messageWithImage = {
              message : message,
              image : screenshot
            };
            socket.emit('new image message', messageWithImage);
            screenshot = undefined;
            $("#input-image").fadeOut();
          } else {
            // tell server to execute 'new message' and send along one parameter
            socket.emit('new message', message);
          }
        }
      };

      // Log a message
      const log = (message, options) => {
        var $el = $('<li>').addClass('log').addClass('shadow').text(message);
        addMessageElement($el, options);
      };

      // Adds a cached chat message to the message list
      const addCachedMessage = (cachedMsg) => {
        addChatMessage(cachedMsg.getData(), { 'time' : cachedMsg.time });
      };

      // Adds the visual chat message to the message list
      const addChatMessage = (data, options) => {
        // Don't fade the message in if there is an 'X was typing'
        var $typingMessages = getTypingMessages(data);
        options = options || {};
        if ($typingMessages.length !== 0) {
          options.fade = false;
          $typingMessages.remove();
        }
        // Other messages
        var $messageBodyDiv2 = $('<div class="media w-100 mb-3"/>');
        var $mediaLeft = $('<div class="media-left"/>');
        var $profilePic = $('<img class="img-thumbnail media-object" src="/plugin/Koha/Plugin/Com/Honkaportaali/AspaTukiChatPlugin/img/user.svg" width="50px" />');
        var $senderInfo = $('<p class="media-object text-center text-muted"/>')
          .text(data.username)
          .css('color', getUsernameColor(data.username));
        var $mediaBody = $('<div class="media-body"/>');
        var $messageBubble = $('<div class="bg-light shadow-sm rounded px-3 mb-1 padding-6"/>');
        var $messageBubbleContent = $('<p>')
          .text(data.message);
        const time = (options.time ?  new Date(options.time) : new Date());
        const formattedTime = convertTimeToEasyString(time);
        var $timeInfo = $('<p class="text-muted mx-8"/>')
          .text(formattedTime);

        // Own messages
        var $ownMessageBodyDiv2 = $('<div class="media w-100 ml-auto mb-3"/>');
        var $ownMessageBubble = $('<div class="bg-primary shadow rounded"/>');
        var $ownMessageBubbleContent = $('<p class="mb-0 text-white padding-6">')
          .text(data.message);
        var $ownTimeInfo = $('<p class="text-muted">')
          .text(formattedTime);

        // Images
        var $imageDiv = '';
        if(data.image !== undefined) {
          const img = new Image();
          img.src = `${data.image}`;
          var $img = $(img).addClass("screenshot");
          $imageDiv = $('<span class="screenshot">')
            .append($img);
        }

        var $messageDiv;

        if(data.typing) {
          var $usernameDiv = $('<span class="username"/>')
          .text(data.username)
          .css('color', getUsernameColor(data.username));
          var $messageBodyDiv = $('<span class="messageBody">')
            .text(data.message);
          var typingClass = data.typing ? 'typing' : '';
          $messageDiv = data.typing ? $('<li class="message"/>')
            .data('username', data.username)
            .addClass(typingClass)
            .append($usernameDiv, $messageBodyDiv) : '';
        } else {
          if (data.username != username) {
            $messageDiv = $messageBodyDiv2.append(
              $mediaLeft.append($profilePic, $senderInfo),
              $mediaBody.append($messageBubble.append($imageDiv, $messageBubbleContent), $timeInfo));
          } else {
            $messageDiv = $ownMessageBodyDiv2.append(
              $mediaBody.append($ownMessageBubble.append($imageDiv, $ownMessageBubbleContent), $timeInfo));
          }
        }
        addMessageElement($messageDiv, options);
      };

      // Adds the visual chat typing message
      const addChatTyping = (data) => {
        data.typing = true;
        data.message = 'kirjoittaa...';
        addChatMessage(data);
      };

      // Removes the visual chat typing message
      const removeChatTyping = (data) => {
        getTypingMessages(data).fadeOut(function () {
          $(this).remove();
        });
      };

      /**
       * Adds a message element to the messages and scrolls to the bottom
       * @param {*} el The element to add as a message
       * @param {*} options options.fade - If the element should fade-in (default = true)
       *                    options.prepend - If the element should prepend
       *                                      all other messages (default = false)
       */
      const addMessageElement = (el, options) => {
        var $el = $(el);

        // Setup default options
        if (!options) {
          options = {};
        }
        if (typeof options.fade === 'undefined') {
          options.fade = true;
        }
        if (typeof options.prepend === 'undefined') {
          options.prepend = false;
        }

        // Apply options
        if (options.fade) {
          $el.hide().fadeIn(FADE_TIME);
        }
        if (options.prepend) {
          $messages.prepend($el);
        } else {
          $messages.append($el);
        }
        scrollTop();
      };

      // Prevents input from having injected markup
      const cleanInput = (input) => {
        return $('<div/>').text(input).html();
      };

      // Updates the typing event
      const updateTyping = () => {
        if (connected) {
          if (!typing) {
            typing = true;
            socket.emit('typing');
          }
          lastTypingTime = (new Date()).getTime();

          setTimeout(() => {
            var typingTimer = (new Date()).getTime();
            var timeDiff = typingTimer - lastTypingTime;
            if (timeDiff >= TYPING_TIMER_LENGTH && typing) {
              socket.emit('stop typing');
              typing = false;
            }
          }, TYPING_TIMER_LENGTH);
        }
      };

      // Gets the 'X is typing' messages of a user
      const getTypingMessages = (data) => {
        return $('.typing.message').filter(function (i) {
          return $(this).data('username') === data.username;
        });
      };

      // Gets the color of a username through our hash function
      const getUsernameColor = (username) => {
        // Compute hash code
        var hash = 7;
        for (var i = 0; i < username.length; i++) {
          hash = username.charCodeAt(i) + (hash << 5) - hash;
        }
        // Calculate color
        var index = Math.abs(hash % COLORS.length);
        return COLORS[index];
      };

      // Shows notification popup with the message
      const showNotify = (data) => {
        Lobibox.notify('default', {
          continueDelayOnInactiveTab: true,
          title: false,
          size: 'mini',
          msg: data.username + ': ' + data.message
        });
      };

      // Send image to server
      const sendImage = (image) => {
        // Server side
        socket.emit('image', image.toString('base64')); // image should be a buffer
      };

      // Keyboard events

      $window.keydown(event => {
        // Auto-focus the current input when a key is typed
        if (!(event.ctrlKey || event.metaKey || event.altKey)) {
          $currentInput.focus();
        }
        // When the client hits ENTER on their keyboard
        if (event.which === 13) {
          if (username) {
            sendMessage();
            socket.emit('stop typing');
            typing = false;
          } else {
            setUsername();
          }
        }
      });

      $inputMessage.on('input', () => {
        updateTyping();
      });

      // Click events

      // Focus input when clicking anywhere on login page
      $loginPage.click(() => {
        $currentInput.focus();
      });

      // Focus input when clicking on the message input's border
      $inputMessage.click(() => {
        $inputMessage.focus();
      });

      // Take screenshot and save it in 'screenshot' variable
      $btnScreenshot.click(() => {
        $('#chatmodal').hide();
        html2canvas(document.body).then(function(canvas) {
          var screenshot1 = canvas;
          var screenshot2 = screenshot1.toDataURL();
          screenshot = screenshot2.toString('base64');
          //document.body.appendChild(canvas);
          console.log("Screenshot captured and saved in variable 'screenshot'");
          // sendImage(screenshot.toDataURL());
          $("#screenshotPreview").removeAttr("src");
          $("#screenshotPreview").attr("src", screenshot2);
          $("#input-image").fadeIn();
        });
        $('#chatmodal').show();
      });

      $btnDeleteImage.click(() => {
        screenshot = undefined;
        $("#input-image").fadeOut();
      });
    
      // Show image viewer modal when clicking on the any screenshot image
      $messages.click((e) => {
        if(e.target.className == "screenshot") {
          $('#imgViewer').html('').append( $(e.target).clone().removeClass('screenshot') );
          $imgviewermodal.css("display", "block");
        }
      });
      $screenshotPreviewPanel.click((e) => {
        if(e.target.classList.contains("screenshot")) {
          $('#imgViewer').html('').append( $(e.target).clone().removeClass('screenshot') );
          $imgviewermodal.css("display", "block");
        }
      });

      // Close image viewer modal when clicking on 'X' button
      $('.imgclose').click(() => {
        $imgviewermodal.css("display", "none");
      });

      // Close image viewer modal when clicking anywhere in window
      $imgviewermodal.click(()=>{
        $imgviewermodal.css("display", "none");
      });

      // Socket events

      // Whenever the server emits 'login', log the login message
      socket.on('login', (data) => {
        connected = true;
        data.activeUsers.map((user) => {
          users.add(user);
          var existingUserData = {
            username : user,
            rand : Math.random() * 10e5
          };
          addToUsersBox(existingUserData);
        });
        if(data.messageCache) {
          data.messageCache.map((msgEntry) => {
            addCachedMessage(new cachedMessage(msgEntry.user, msgEntry.content, msgEntry.time, msgEntry.image));
          });
        }
        addToUsersBox(data);
        // Display the welcome message
        var message = "AspaTukiChat – " + motd;
        log(message, {
          prepend: true
        });
        addParticipantsMessage(data);
        restoreChatState();
      });

      // Whenever the server emits 'new message', update the chat body
      socket.on('new message', (data) => {
        addChatMessage(data);
        if(!isElementVisible($('#chatmodal'))) {
          ++unreadMsgs;
          updateUnreadMsgs(unreadMsgs);
          showNotify(data);
        }
      });

      // Whenever the server emits 'user joined', log it in the chat body
      socket.on('user joined', (data) => {
        log(data.username + ' liittyi');
        data.activeUsers.map((user) => {
          users.add(user);
        });
        addToUsersBox(data);
        addParticipantsMessage(data);
      });

      // Whenever the server emits 'user left', log it in the chat body
      socket.on('user left', (data) => {
        log(data.username + ' poistui');
        addParticipantsMessage(data);
        removeChatTyping(data);
        removeFromUsersBox(data);
      });

      // Whenever the server emits 'typing', show the typing message
      socket.on('typing', (data) => {
        addChatTyping(data);
      });

      // Whenever the server emits 'stop typing', kill the typing message
      socket.on('stop typing', (data) => {
        removeChatTyping(data);
      });

      socket.on('disconnect', () => {
        log('yhteys katkaistu');
      });

      socket.on('reconnect', () => {
        log('yhteys muodostettu uudelleen');
        if (username) {
          socket.emit('add user', username);
        }
      });

      socket.on('reconnect_error', () => {
        log('yhteyden muodostaminen uudelleen ei onnistunut');
      });

      // Whenever the server emits 'new server message', update the chat body
      socket.on('new server message', (data) => {
        console.log("data: %s", data);
        var data2 = {
          username: 'System',
          message: data.data
        };
        addChatMessage(data2);
      });

      // Receive images
      socket.on('image', image => {
        console.log("socket.on image event called");
        // create image with
        const img = new Image();
        // change image type to whatever you use, or detect it in the backend 
        // and send it if you support multiple extensions
        img.src = `data:image/jpg;base64,${image}`; 
        // Insert it into the DOM
        //TODO: Do something with image
      });

      //---- Ajax bridge to Perl side ----//

      function send_and_show(message, userdata, sub, callback) {
        showLoading(message);
        send_data(userdata, sub, function () {
          hideLoading();
          callback();
        });
      }

      function send_data(userdata, sub, callback) {
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

      //---- Helper functions ----//

      function updateUnreadMsgs(count) {
        document.querySelector("#unreadMsgs").innerText = count > 0 ? count : "";
      }

      function showLoading(msg) {
        $('#loadingMsg').html(msg + "...");
        $('#loadingAnim').show();
      }

      function hideLoading() {
        $('#loadingAnim').hide();
      }

      function convertUnixTimestamp(t) {
        var a = new Date(t * 1000);
        return convertTimeToEasyString(a);
      }

      function convertTimeToEasyString(t) {
        var a = t;
        var today = new Date();
        var yesterday = new Date(Date.now() - 86400000);
        var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        var year = a.getFullYear();
        var month = months[a.getMonth()];
        var date = a.getDate();
        var hour = a.getHours();
        var min = a.getMinutes() < 10 ? a.getMinutes() + "0" : a.getMinutes();
        if (a.setHours(0, 0, 0, 0) == today.setHours(0, 0, 0, 0))
          return 'tänään, ' + hour + ':' + min;
        else if (a.setHours(0, 0, 0, 0) == yesterday.setHours(0, 0, 0, 0))
          return 'eilen, ' + hour + ':' + min;
        else if (year == today.getFullYear())
          return date + ' ' + month + ', ' + hour + ':' + min;
        else
          return date + ' ' + month + ' ' + year + ', ' + hour + ':' + min;
      }

      // Screenshot capture
      function takeScreenshot() {
        html2canvas(document.body).then(function(canvas) {
          screenshot = canvas;
          document.body.appendChild(canvas);
        });
      }

      // Check if the given element is visible
      const isElementVisible = (elementName) => { return elementName.css("display") != "null" && elementName.css("display") != "none"; };

      //Log in when everything is ready
      $(document).ready(function () {
        if (username) {
          setUsername();

          // Focus chat inputbox and create cookie to keep chat open when the the chat is opened
          $('#chatmodal').on('shown.bs.modal', function () {
            $.cookie("isChatOpen", 1);
            unreadMsgs = 0;
            $('#txtMessage').focus();
          });

          // Remove isChatOpen-cookie
          $('#chatmodal').on('hidden.bs.modal', function () {
            $.removeCookie("isChatOpen");
          });

          $('#btnChatMinimize').click( () => {
            hideChat();
          });

          $('#chatBtn').click( () => {
            isChatVisible = !isChatVisible;
            if(isChatVisible) {
              $('#chatmodal').fadeIn();
              scrollTop();
              $.cookie("isChatOpen", 1);
              unreadMsgs = 0;
              updateUnreadMsgs(unreadMsgs);
              $('#txtMessage').focus();
            } else {
              hideChat();
            }
          });

          $('#btnChatMaximize').click( () => {
            var $chatmessages = $("#chatmessages");
            var maximize = $chatmessages.height() <= MAX_HEIGHT;

            if(maximize) {
              $('#btnChatMaximize').children().removeClass("fa-window-maximize");
              $('#btnChatMaximize').children().addClass("fa-window-restore");
              $chatmessages.css("max-height", window.innerHeight + "px");
            } else {
              $('#btnChatMaximize').children().removeClass("fa-window-restore");
              $('#btnChatMaximize').children().addClass("fa-window-maximize");
              $chatmessages.css("max-height", MAX_HEIGHT + "px");
            }          
          });
        }

        $('[data-bs-click-animate]')
          .mousedown( function(){ var elem = $(this); elem.addClass('animated ' + elem.attr('data-bs-click-animate')); })
          .mouseup( function(){ var elem = $(this); elem.removeClass('animated ' + elem.attr('data-bs-click-animate')); });
      });
      
    });
  });
});

function scrollTop() {
  //$messages[0].scrollTop = $messages[0].scrollHeight;
  $('.chat-box')[0].scrollTop = $('.chat-box')[0].scrollHeight;
}

function hideChat() {
  isChatVisible = false;
  $('#chatmodal').fadeOut();
  $.removeCookie("isChatOpen");
}

function restoreChatState() {
  isChatVisible = ($.cookie("isChatOpen") == 1);
  if(isChatVisible) {
    $('#chatmodal').show();
    scrollTop();
  }
}