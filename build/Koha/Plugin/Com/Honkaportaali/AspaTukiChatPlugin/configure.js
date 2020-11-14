var payload = {};
var error;
var btnEnableChat, btnDisableChat, btnPurgeMessages, btnPurgeMessagesOlder, btnPurgeUsers, btnPurgeUsersOlder;
  //enableChatBtn
  //disableChatBtn
//txtMotd
//saveMotd
//resetMotd
//purgeMessagesFeedback
//purgeAllMessages
//purgeOlderMessages
//purgeUsersFeedback
//purgeAllUsers
//purgeOlderUsers
  //spinnerEnableBtn
  //spinnerDisableBtn
//spinnerPurgeMessagesAll
//spinnerPurgeMessagesOlder
//spinnerPurgeUsersAll
//spinnerPurgeUsersOlder
  //enableDisableChatFeedback
//purgeMessagesFeedback
//purgeUsersFeedback

function Button(buttonId, spinnerId, feedbackId, onClickFunction) {
  this.btnObject = $('#' + buttonId);
  this.spinnerObject = $('#' + spinnerId);
  this.isDisabled = false;
  this.feedbackObject = $('#' + feedbackId);
  
  $('#' + buttonId).click( onClickFunction );
  $('#' + feedbackId).on('show', function(event) {
    var feedback = $(event.currentTarget);
    feedback.addClass('animated flash');
    feedback.one('webkitAnimationEnd mozAnimationEnd MSAnimationEnd oanimationend animationend', function () {
      $( this ).hide();
      $( this ).removeClass('animated flash');
    });
  });
  
  this.setEnabled = function (isEnabled) {
    if (!isEnabled) {
        this.spinnerObject.hide();
    }
    this.isDisabled = !isEnabled;
    this.btnObject.disabled = !isEnabled;
    if(isEnabled) {
      this.btnObject.removeClass('disabled');
    } else {
      this.btnObject.addClass('disabled');
    }
    
  };
  
  this.showSpinner = function (isVisible) {
    if (isVisible) {
        this.spinnerObject.show();
    } else {
        this.spinnerObject.hide();
        this.feedbackObject.hide();
    }
  };
  
  this.showFeedback = function () {
    this.feedbackObject.show();
  };
}



$( document ).ready(function() {
  btnEnableChat = new Button("enableChatBtn", "spinnerEnableBtn", "enableDisableChatFeedback", function() { enableChat(true) });
  btnDisableChat = new Button("disableChatBtn", "spinnerDisableBtn", "enableDisableChatFeedback", function() { enableChat(false) });
  btnPurgeMessages = new Button("purgeAllMessages", "spinnerPurgeMessagesAll", "purgeMessagesFeedback", function() { purgeMessages(true) });
  btnPurgeMessagesOlder = new Button("purgeOlderMessages", "spinnerPurgeMessagesOlder", "purgeMessagesFeedback", function() { purgeMessages(false) });
  btnPurgeUsers = new Button("purgeAllUsers", "spinnerPurgeUsersAll", "purgeUsersFeedback", function() { purgeUsers(true) });
  btnPurgeUsersOlder = new Button("purgeOlderUsers", "spinnerPurgeUsersOlder", "purgeUsersFeedback", function() { purgeUsers(false) });
  btnSaveMotd = new Button("saveMotd", "spinnerSaveMotd", "saveMotdFeedback", function() { saveMotd($("#txtMotd").val()) });
});

function saveMotd(newMotd) {
  btnSaveMotd.showSpinner(true);
  send( { "motd" : newMotd }, "savemotd", function(result) {
    if(result.status == "saved") {
      btnSaveMotd.showSpinner(false);
      $("#txtMotd").text(result.data);
      btnSaveMotd.showFeedback();
    }
  }, function() {
    btnSaveMotd.showSpinner(false);
  });
}

function enableChat(isEnabled) {
    btnEnableChat.showSpinner(isEnabled);
    btnDisableChat.showSpinner(!isEnabled);
    
    send( { "enable" : (isEnabled ? 1 : 0) }, "enable_chat", function(result) {
      if(result.status == "enabled") {
        btnEnableChat.setEnabled(!isEnabled);
        btnDisableChat.setEnabled(isEnabled);
        btnEnableChat.showFeedback();
      }
      if (result.status == "disabled") {
        btnDisableChat.setEnabled(!isEnabled);
        btnEnableChat.setEnabled(isEnabled);
        btnDisableChat.showFeedback();
      }
    }, function() {
      btnEnableChat.showSpinner(false);
      btnDisableChat.showSpinner(false);
      
      payload = {
          "username":     $(".loggedinusername").html()
      };
      
      send_data( payload, "login", onLogin );
    });
}

function purgeMessages(purgeAll) {
    btnPurgeMessages.showSpinner(purgeAll);
    btnPurgeMessagesOlder.showSpinner(!purgeAll);
    
    send( { "olderthan" : (purgeAll ? 7 : 86400) }, "purge_messages", function(result) {
      if(result.status == "purged") {
        btnPurgeMessages.showSpinner(false);
        btnPurgeMessagesOlder.showSpinner(false);
        $("#messageCount").text(result.data);
        btnPurgeMessages.showFeedback();
      }
    }, function() {
      btnPurgeMessages.showSpinner(false);
      btnPurgeMessagesOlder.showSpinner(false);
    });
}

function purgeUsers(purgeAll) {
    btnPurgeUsers.showSpinner(purgeAll);
    btnPurgeUsersOlder.showSpinner(!purgeAll);
    
    send( { "olderthan" : (purgeAll ? 7 : 86400) }, "purge_users", function(result) {
      if(result.status == "purged") {
        btnPurgeUsers.showSpinner(false);
        btnPurgeUsersOlder.showSpinner(false);
        $("#userCount").text(result.data);
        btnPurgeUsers.showFeedback();
      }
    }, function() {
      btnPurgeUsers.showSpinner(false);
      btnPurgeUsersOlder.showSpinner(false);
    });
}

//$('#create_template').click( create_template );
//$('#save_template').on('click', function (event) {
//  console.log("save_template event: click");
//  var button = $(event.currentTarget); // Button that triggered the modal
//  var templateId = button.data('templateid'); // Extract info from data-* attributes
//  var templateText = button.context.form.elements[4].value;
//  console.log("save_template: templateId = " + templateId + ", templateText = " + templateText);
//  save_template(templateId, templateText);
//});

//$('#deleteModal').on('show.bs.modal', function (event) {
//  console.log("event: show.bs.modal");
//  var button = $(event.relatedTarget); // Button that triggered the modal
//
//  var templateName = button.data('templatename'); // Extract info from data-* attributes
//  var templateId = button.data('templateid');
//  // If necessary, you could initiate an AJAX request here (and then do the updating in a callback).
//  // Update the modal's content. We'll use jQuery here, but you could use a data binding library or other methods instead.
//  var modal = $('#deleteModal');//$(this);
//  modal.find('.modal-body #delete-template-id').text("ID:" + templateId);
//  modal.find('.modal-body #delete-template-name').text(templateName);
//  $('#confirmDelete').on('click', function () {
//    delete_template(templateId);
//    $('#deleteModal').modal('hide');
//  });
//});

function send( userdata, sub, onSuccess, onDone ) {
    console.log("send()");

    var data = {};
    data.userdata = JSON.stringify(userdata);
    data.class = "Koha::Plugin::Com::Honkaportaali::AspaTukiChatPlugin";
    data.method = "tool";
    data.sub = sub;

    $.ajax({ 
        type: "POST",
        url: "/cgi-bin/koha/plugins/run.pl",
        data: data,
        success: onSuccess,
        dataType: "json"
    }).done( onDone ).fail(function(jqXHR, textStatus) {
      alert( "Error: " + textStatus );
    });
}
