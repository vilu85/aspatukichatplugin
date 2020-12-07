package Koha::Plugin::Com::Honkaportaali::AspaTukiChatPlugin;

use Modern::Perl;

use base qw(Koha::Plugins::Base);

use C4::Auth;
use C4::Context;
use C4::Auth qw/check_cookie_auth haspermission/;
use Koha::Database;
use Koha::Libraries;
use Koha::Patrons;
use Cwd qw(abs_path);
use Data::Dumper;
use Encode;
use JSON qw(to_json from_json);
use List::MoreUtils qw(uniq);
use MIME::Base64;
use MIME::Lite;
use YAML;
use JSON qw(to_json from_json);
use CGI;
use CGI::Cookie;
use CGI::Carp qw/fatalsToBrowser/;
use strict;

## Here we set our plugin version
our $VERSION = "1.0.0";

## Here is our metadata, some keys are required, some are optional
our $metadata = {
    name   => 'AspaTukiChatPlugin Plugin',
    author => 'Ville Perkkio',
    description => 'This plugin adds chat for intranet',
    date_authored   => '2020-05-21',
    date_updated    => '2020-12-05',
    minimum_version => '19.05.00.000',
    maximum_version => undef,
    version         => $VERSION,
};

## This is the minimum code required for a plugin's 'new' method
## More can be added, but none should be removed
sub new {
    my ( $class, $args ) = @_;

    ## We need to add our metadata here so our base class can access it
    $args->{'metadata'} = $metadata;
    $args->{'metadata'}->{'class'} = $class;

    ## Here, we call the 'new' method for our base class
    ## This runs some additional magic and checking
    ## and returns our actual $self
    my $self = $class->SUPER::new($args);

    return $self;
}

## The existance of a 'tool' subroutine means the plugin is capable
## of running a tool. The difference between a tool and a report is
## primarily semantic, but in general any plugin that modifies the
## Koha database should be considered a tool
sub tool {
    my ( $self, $args ) = @_;

    my $cgi = $self->{'cgi'};
    my $handler = $cgi->param('sub');
    
    if ( $handler eq 'get_last_messages' ) {
        $self->get_last_messages();
        return $self;
    }
    if ( $handler eq 'accept_messages') {
        $self->accept_messages();
        return $self;
    }
    if ( $handler eq 'get_initial_data') {
        $self->get_initial_data();
        return $self;
    }
    if ( $handler eq 'new_message' ) {
        $self->new_message();
        return $self;
    }
    if ( $handler eq 'login' ) {
        $self->login();
        return $self;
    }
    if ( $handler eq 'enable_chat' ) {
        $self->enable_chat();
        return $self;
    }
    if ( $handler eq 'purge_messages' ) {
        $self->purge_messages();
        return $self;
    }
    if ( $handler eq 'purge_users' ) {
        $self->purge_users();
        return $self;
    }
    if ( $handler eq 'savemotd' ) {
        $self->savemotd();
        return $self;
    }
    if ( $handler eq 'savehost' ) {
        $self->savehost();
        return $self;
    }
    if ( $handler eq 'get_configuration' ) {
        $self->configuration_script();
        return $self;
    }
    else {
        unless ( $cgi->param('submitted') ) {
            $self->tool_step1();
        }
        else {
            $self->tool_step2();
        }       
    };
}

sub get_last_messages {
    my ( $self, $args ) = @_;
    $self->dieIfOffline();
    my $cgi            = $self->{'cgi'};
    my $params         = $cgi->Vars;
    my $r              = from_json( $params->{userdata} );
    my $logged_in_user = _getLoggedInUser( $r->{username} );
    
    $r->{success}              = 1;
    $r->{username}             = $logged_in_user;
    $r->{messagesjson}         = getMessagesJson($self, $args)->{messagesjson};
    $r->{timestamp}            = time;
    
    print $cgi->header('application/json');
    print to_json($r);
}

## Return last 15 messages ##
sub getMessages {
    my ( $self, $args ) = @_;
    $self->dieIfOffline();
    
    my $dbh = C4::Context->dbh;

    my $table = $self->get_qualified_table_name('messages');
    my $user_table = $self->get_qualified_table_name('users');
    
    my $sth   = $dbh->prepare("SELECT `$table`.*, `$user_table`.`name`, UNIX_TIMESTAMP()-`$table`.`when` AS 'diff' FROM `$table` INNER JOIN `$user_table` ON `$user_table`.`id` = `$table`.`member_id` ORDER BY `id` DESC LIMIT 15");
    $sth->execute();

    my @aMessages;
    while ( my $row = $sth->fetchrow_hashref() ) {
        push( @aMessages, ( $row ) );
    }

    my $sMessages = "";
    my $aMessage = "";

    # collecting list of messages
    foreach $aMessage ( @aMessages ) {
        my $sExStyles = "";
        my $sExJS = "";
        my $iDiff = $aMessage->{diff};
        
        if ($iDiff < 7) {
            $sExStyles = 'style="display:none;"';
            $sExJS = "<script> \$('#message_" . $aMessage->{id} . "').slideToggle('slow'); </script>";
        }
        my $sWhen = scalar(localtime($aMessage->{when}));
        $sMessages .= '<div class="chatmessage" id="message_'.$aMessage->{id}.'" '.$sExStyles.'>' . $aMessage->{name} . ': ' . $aMessage->{message} . '<span>(' . $sWhen . ')</span></div>' . $sExJS;
    }

    return $sMessages;
}

sub getMessagesJson {
    my ( $self, $args ) = shift;
    $self->dieIfOffline();
    
    my $cgi            = $self->{'cgi'};
    my $params         = $cgi->Vars;
    my $r              = from_json( $params->{userdata} );
    #my $logged_in_user = _getLoggedInUser( $r->{username} );
    my $last_timestamp = $r->{timestamp};
    
    my $dbh = C4::Context->dbh;

    my $table = $self->get_qualified_table_name('messages');
    my $user_table = $self->get_qualified_table_name('users');
    
    my $sth   = $dbh->prepare("SELECT `$table`.*, `$user_table`.`name`, UNIX_TIMESTAMP()-`$table`.`when` AS 'diff' FROM `$table` INNER JOIN `$user_table` ON `$user_table`.`id` = `$table`.`member_id` ORDER BY `id` ASC LIMIT 15");
    $sth->execute();

    my @aMessages;
    while ( my $row = $sth->fetchrow_hashref() ) {
        push( @aMessages, ( $row ) );
    }

    my $sMessages       = "";
    my $aMessage        = "";
    my $iUserID         = _getLoggedInUser( $r->{username} )->{cardnumber};
    my @parsedMessages;
    
    # collecting list of messages
    foreach $aMessage ( @aMessages ) {
        my $iDiff = $aMessage->{diff};
        my $ownMessage = ( $aMessage->{member_id} eq $iUserID );
        
        if ($last_timestamp) {
            next if $last_timestamp > $aMessage->{when};
        }
        
        #my $sWhen = scalar(localtime($aMessage->{when}));
        
        my $messageEntry = {
            from        =>  $aMessage->{name},
            content     =>  $aMessage->{message},
            isOwn       =>  $ownMessage,
            timestamp   =>  $aMessage->{when},
            diff        =>  $iDiff,
            id          =>  $aMessage->{id},
            lastTimeStampUsedInChecking => $last_timestamp
        };
        
        push( @parsedMessages, ( $messageEntry ) );
    }
    
    $r->{messagesjson}         = \@parsedMessages;
    return $r;
}

sub new_message {
    my ( $self, $args ) = @_;
    $self->dieIfOffline();
    
    my $cgi            = $self->{'cgi'};
    my $params         = $cgi->Vars;
    my $r              = from_json( $params->{userdata} );
    my $newMessage     = $r->{message};
    
    my $sUsername      = _getLoggedInUser( $r->{username} )->{firstname};
    my $iUserID        = _getLoggedInUser( $r->{username} )->{cardnumber};
    
    if($sUsername && $newMessage ne '') {
        my $sMessage = C4::Koha::xml_escape($newMessage);
        if ($sMessage ne '') {
            my $dbh = C4::Context->dbh;
            
            # Add message
            my $table = $self->get_qualified_table_name('messages');
            my $sth = $dbh->prepare("INSERT INTO $table (`member_id`, `member_name`, `message`, `when`) VALUES ( ?, ?, ?, UNIX_TIMESTAMP())");
            my $success = $sth->execute($iUserID, $sUsername, $sMessage);
            
            # Update user timestamp
            my $user_table = $self->get_qualified_table_name('users');
            my $sth2 = $dbh->prepare("INSERT INTO $user_table (`id`, `name`, `when`) VALUES ( ?, ?, UNIX_TIMESTAMP()) ON DUPLICATE KEY UPDATE `when` = UNIX_TIMESTAMP()");
            my $success2 = $sth2->execute($iUserID, $sUsername);
            
            $r->{success}              = $success2;
            #$r->{messages}            = getMessages($self, $args);
            $r->{messagesjson}         = getMessagesJson($self, $args)->{messagesjson};
            $r->{timestamp}            = time;
    
            print $cgi->header('application/json');
            print to_json($r);
        }
    }
}

sub accept_messages {
    my ( $self, $args ) = @_;
    $self->dieIfOffline();
    my $cgi            = $self->{'cgi'};
    my $params         = $cgi->Vars;
    my $r              = from_json( $params->{userdata} );
    my $newMessage     = $r->{message};
    
    my $sUsername      = _getLoggedInUser( $r->{username} )->{firstname};
    my $iUserID        = _getLoggedInUser( $r->{username} )->{cardnumber};
    
    if($sUsername && $newMessage ne '') {
        my $sMessage = C4::Koha::xml_escape($newMessage);
        if ($sMessage ne '') {
            my $dbh = C4::Context->dbh;
            my $table = $self->get_qualified_table_name('messages');           
            my $sth = $dbh->prepare("INSERT INTO $table (`member_id`, `member_name`, `message`, `when`) VALUES ( ?, ?, ?, UNIX_TIMESTAMP())");
            my $success = $sth->execute($iUserID, $sUsername, $sMessage);
            return 1;
        }
    }
}

sub get_initial_data {
    my ( $self, $args ) = @_;
    $self->dieIfOffline();
    
    my $cgi            = $self->{'cgi'};
    my $params         = $cgi->Vars;
    my $r              = from_json( $params->{userdata} );
    my $logged_in_user = _getLoggedInUser( $r->{username} );

    $r->{success}              = 1;
    $r->{user}                 = $logged_in_user;
    
    my $dbh = C4::Context->dbh;

    my $table = $self->get_qualified_table_name('messages');
    my $user_table = $self->get_qualified_table_name('users');
    
    my $sth   = $dbh->prepare("SELECT `$table`.*, `$user_table`.`name`, UNIX_TIMESTAMP()-`$table`.`when` AS 'diff' FROM `$table` INNER JOIN `$user_table` ON `$user_table`.`id` = `$table`.`member_id` ORDER BY `id` ASC LIMIT 15");
    $sth->execute();

    my @aMessages;
    while ( my $row = $sth->fetchrow_hashref() ) {
        push( @aMessages, ( $row ) );
    }

    my $sMessages       = "";
    my $aMessage        = "";
    my $iUserID         = _getLoggedInUser( $r->{username} )->{cardnumber};
    my @parsedMessages;
    
    # collecting list of messages
    foreach $aMessage ( @aMessages ) {
        my $iDiff = $aMessage->{diff};
        my $ownMessage = ( $aMessage->{member_id} eq $iUserID );
        
        my $messageEntry = {
            from        =>  $aMessage->{name},
            content     =>  $aMessage->{message},
            isOwn       =>  $ownMessage,
            timestamp   =>  $aMessage->{when},
            diff        =>  $iDiff
        };
        
        push( @parsedMessages, ( $messageEntry ) );
    }
    
    $r->{messagesjson}         = getMessagesJson($self, $args)->{messagesjson};
    $r->{timestamp}            = time;
    
    print $cgi->header('application/json');
    print to_json($r);
}

sub login {
    my ( $self, $args ) = @_;
    my $cgi            = $self->{'cgi'};
    my $params         = $cgi->Vars;
    
    #my %cookies = CGI::Cookie->fetch;
    #my $sid = $cookies{'CGISESSID'}->value;
    #my ( $auth_status, $sessionID ) = check_cookie_auth( $sid );
    #my $uid = C4::Auth::get_session($sid)->param('id');
    
    #if( $auth_status ne 'ok' || !$allowed ) {
    #    send_reply( 'denied' );
    #    exit 0;
    #}
    
    my $r              = from_json( $params->{userdata} );    
    my $sUsername      = _getLoggedInUser( $r->{username} )->{firstname};
    my $iUserID        = _getLoggedInUser( $r->{username} )->{cardnumber};
    my $motd = $self->retrieve_data('motd');
    my $isEnabled = $self->isChatEnabled();
    
    if(!$isEnabled) {
        send_reply('offline', $motd, 'Chat system is offline');
        exit 0;
    }
    
    if($sUsername && $iUserID ne '') {
        my $dbh = C4::Context->dbh;
        my $user_table = $self->get_qualified_table_name('users');           
        my $sth = $dbh->prepare("INSERT INTO $user_table (`id`, `name`, `when`) VALUES ( ?, ?, UNIX_TIMESTAMP()) ON DUPLICATE KEY UPDATE `when` = UNIX_TIMESTAMP()");
        my $success = $sth->execute($iUserID, $sUsername);
        
        if($success) {
            send_reply('authok', $motd);
        } else {
            send_reply('authfail');
        }
    }
}

sub enable_chat {
    my ( $self, $args ) = @_;
    my $cgi            = $self->{'cgi'};
    my $params         = $cgi->Vars;
    
    my $r              = from_json( $params->{userdata} );
    my $enableChat     = $r->{enable};
    
    if($enableChat ne '') {
        $self->store_data( { is_enabled => $enableChat } );
        
        my $result = ($enableChat eq 1 ? 'enabled' : 'disabled');
        send_reply($result);
    } else {
        send_reply('failed', 'Missing parameter');
    }
}

sub purge_messages {
    my ( $self, $args ) = @_;
    my $cgi            = $self->{'cgi'};
    my $params         = $cgi->Vars;
    
    my $r              = from_json( $params->{userdata} );
    my $olderthan      = $r->{olderthan};
    
    if($olderthan ne '') {
        my $timelimit = ($olderthan > 7 ? 'DAY' : 'MINUTE');
        
        my $dbh = C4::Context->dbh;
        my $messages_table = $self->get_qualified_table_name('messages');
        my $sth   = $dbh->prepare("DELETE FROM $messages_table WHERE `when` < UNIX_TIMESTAMP(NOW() - INTERVAL 1 $timelimit);");
        my $success = $sth->execute();
        
        if ($success) {
            $sth   = $dbh->prepare("SELECT COUNT(*) As Total FROM $messages_table");
            $sth->execute();
            my $rowq = $sth->fetchrow_hashref;
            my $messageCount = $rowq->{'Total'};
            send_reply('purged', $messageCount);
        } else {
            send_reply('failed', '', $success);
        }
        
    } else {
        send_reply('failed', '', 'Missing parameter');
    }
}

sub purge_users {
    my ( $self, $args ) = @_;
    my $cgi            = $self->{'cgi'};
    my $params         = $cgi->Vars;
    
    my $r              = from_json( $params->{userdata} );
    my $olderthan      = $r->{olderthan};
    
    if($olderthan ne '') {
        my $timelimit = ($olderthan > 7 ? 'DAY' : 'MINUTE');
        
        my $dbh = C4::Context->dbh;
        my $user_table = $self->get_qualified_table_name('users');
        my $sth   = $dbh->prepare("DELETE FROM $user_table WHERE `when` < UNIX_TIMESTAMP(NOW() - INTERVAL 1 $timelimit);");
        my $success = $sth->execute();
        
        if ($success) {
            $sth   = $dbh->prepare("SELECT COUNT(*) As Total FROM $user_table");
            $sth->execute();
            my $rowqq = $sth->fetchrow_hashref;
            my $userCount = $rowqq->{'Total'};
            send_reply('purged', $userCount);
        } else {
            send_reply('failed', '', $success);
        }
        
    } else {
        send_reply('failed', '', 'Missing parameter');
    }
}

sub savemotd {
    my ( $self, $args ) = @_;
    my $cgi            = $self->{'cgi'};
    my $params         = $cgi->Vars;
    
    my $r              = from_json( $params->{userdata} );
    my $motd           = C4::Koha::xml_escape($r->{motd});
    
    $self->store_data( { motd => $motd } );
    send_reply('saved', $motd);
}

sub savehost {
    my ( $self, $args ) = @_;
    my $cgi            = $self->{'cgi'};
    my $params         = $cgi->Vars;
    
    my $r              = from_json( $params->{userdata} );
    my $sockethost     = C4::Koha::xml_escape($r->{host});
    
    $self->store_data( { host => $sockethost } );
    send_reply('saved', $sockethost);
}

sub update_user_state {
    my ( $self, $args ) = @_;
    $self->dieIfOffline();
    my $cgi            = $self->{'cgi'};
    my $params         = $cgi->Vars;
    
    #my %cookies = CGI::Cookie->fetch;
    #my $sid = $cookies{'CGISESSID'}->value;
    #my ( $auth_status, $sessionID ) = check_cookie_auth( $sid );
    #my $uid = C4::Auth::get_session($sid)->param('id');
    
    #if( $auth_status ne 'ok' || !$allowed ) {
    #    send_reply( 'denied' );
    #    exit 0;
    #}
    
    my $r              = from_json( $params->{userdata} );    
    my $sUsername      = _getLoggedInUser( $r->{username} )->{firstname};
    my $iUserID        = _getLoggedInUser( $r->{username} )->{cardnumber};
    
    if($sUsername && $iUserID ne '') {
        my $dbh = C4::Context->dbh;
        my $user_table = $self->get_qualified_table_name('users');
        my $sth = $dbh->prepare("INSERT INTO $user_table (`id`, `name`, `when`) VALUES ( ?, ?, UNIX_TIMESTAMP()) ON DUPLICATE KEY UPDATE `when` = UNIX_TIMESTAMP()");
        my $success = $sth->execute($iUserID, $sUsername);
        
        if($success) {
            send_reply('authok');
        } else {
            send_reply('authfail');
        }
    }
}

sub send_reply {    # response will be sent back as JSON
    my ( $status, $data, $error ) = @_;
    my $reply = CGI->new("");
    print $reply->header( -type => 'text/html', -charset => 'UTF-8' );
    print JSON::encode_json({
        status => $status,
        data => $data,
        errors => $error,
   });
}

sub tool_step1 {
    my ( $self, $args ) = @_;
    my $cgi = $self->{'cgi'};

    my $template = $self->get_template({ file => 'tool-step1.tt' });

    $self->output_html( $template->output() );
}

sub tool_step2 {
    my ( $self, $args ) = @_;
    my $cgi = $self->{'cgi'};
    my $template = $self->get_template({ file => 'tool-step2.tt' });

    $template->param( 'message' => $cgi->param('message'));

    $self->output_html( $template->output() );
}

sub configuration_script {
    my ( $self, $args ) = @_;
    my $cgi = $self->{'cgi'};
    my $scriptTemplate = $self->get_template({ file => 'configuration-script.tt' });

    $scriptTemplate->param(
        is_chat_enabled => $self->isChatEnabled(),
        motd => $self->retrieve_data('motd'),
        host => $self->retrieve_data('host')
    );

    $self->output_html( $scriptTemplate->output() );
}

sub _getLoggedInUser {
    my $username = shift;
    my $schema   = Koha::Database->new()->schema();
    my $rs = $schema->resultset('Borrower')->search( { userid => $username },
        { columns => [qw( email firstname surname userid cardnumber )] } );
    my $user;
    $rs->result_class('DBIx::Class::ResultClass::HashRefInflator');
    for my $row ( $rs->all ) {
        $user = $row;
    }
    return $user;
}

sub opac_head {
    my ( $self ) = @_;

    #return q|
    #    <link rel="stylesheet" href="/plugin/Koha/Plugin/Com/Honkaportaali/AspaTukiChatPlugin/dist/css/lobibox.min.css"/>
    #|;
    
    return "";
}

sub intranet_head {
    my ( $self ) = @_;
    
    return q|
        <link rel="stylesheet" href="/plugin/Koha/Plugin/Com/Honkaportaali/AspaTukiChatPlugin/aspatukichat.css"/>
    |;
}

sub intranet_js {
    my ( $self ) = @_;
	
    my $userenv = C4::Context->userenv;

    if($userenv and $userenv->{flags} > 0) {
        my $socketio_js = q[$.getScript('/plugin/Koha/Plugin/Com/Honkaportaali/AspaTukiChatPlugin/socket.io/socket.io.js')];
        my $aspatukichat_js = q[$.getScript('/plugin/Koha/Plugin/Com/Honkaportaali/AspaTukiChatPlugin/aspatukichat_node.js');];

        my $chat_configuration = q[
            var is_chat_enabled = ] . $self->isChatEnabled() .q[;
            var motd = '] . $self->retrieve_data('motd') . q[';
            var host = '] . $self->retrieve_data('host') . q[';
        ];

        return q|
            <script>| . $socketio_js . q|</script>
            <script>| . $chat_configuration . $aspatukichat_js . q|</script>
        |;
    }

    return;
}

## If your tool is complicated enough to needs it's own setting/configuration
## you will want to add a 'configure' method to your plugin like so.
## Here I am throwing all the logic into the 'configure' method, but it could
## be split up like the 'report' method is.
sub configure {
    my ( $self, $args ) = @_;
    my $cgi = $self->{'cgi'};
    my $template   = $self->get_template( { file => 'configure.tt' } );
    
    if($cgi->param('save')) {
        my $newTemplateName    = $cgi->param('template_name');
        my $newTemplateText    = $cgi->param('template_text');

        if($newTemplateName ne '' && $newTemplateText ne '') {
            my $dbh = C4::Context->dbh;
            my $template_table = $self->get_qualified_table_name('templates');
        
            my $sth   = $dbh->prepare("INSERT INTO $template_table (name, template) VALUES ( ?, ? )");
            $sth->execute($newTemplateName, $newTemplateText);
        }
        
        $self->store_data(
            {
                last_configured_by => C4::Context->userenv->{'number'},
            }
        );
        #$self->go_home();
    }
    
    my $pluginsdir = C4::Context->config("pluginsdir");

    my %cookies = CGI::Cookie->fetch;
    my $sid = $cookies{'CGISESSID'}->value;
    my ( $auth_status, $sessionID ) = check_cookie_auth( $sid );
    my $uid = C4::Auth::get_session($sid)->param('id');
    
    ## Get templates from db
    my $dbh = C4::Context->dbh;
    my $message_table = $self->get_qualified_table_name('messages');        
    my $sth   = $dbh->prepare("SELECT COUNT(*) As Total FROM $message_table");
    $sth->execute();
    my $rowq = $sth->fetchrow_hashref;
    my $messageCount = $rowq->{'Total'};

    my $user_table = $self->get_qualified_table_name('users');        
    $sth   = $dbh->prepare("SELECT COUNT(*) As Total FROM $user_table");
    $sth->execute();
    my $rowqq = $sth->fetchrow_hashref;
    my $userCount = $rowqq->{'Total'};
    
    #$self->store_data( { is_enabled => $enableChatInt } );
    my $enableChatBtn = ($self->retrieve_data('is_enabled') eq 1 ? 'disabled' : '');
    my $disableChatBtn = ($self->retrieve_data('is_enabled') eq 1 ? '' : 'disabled');
    
    ## Grab the values we already have for our settings, if any exist
    $template->param(
        last_upgraded => $self->retrieve_data('last_upgraded'),
        btn_chat_enable => $enableChatBtn,
        btn_chat_disable => $disableChatBtn,
        motd => $self->retrieve_data('motd'),
        host => $self->retrieve_data('host'),
        message_count => $messageCount,
        user_count => $userCount,
        sid => $sid,
        uid => $uid,
        session_id => $sessionID,
        plugins_dir   => $pluginsdir
    );

    $self->output_html( $template->output() );
}

## This is the 'install' method. Any database tables or other setup that should
## be done when the plugin if first installed should be executed in this method.
## The installation method should always return true if the installation succeeded
## or false if it failed.
sub install() {
    my ( $self, $args ) = @_;

    my $table = $self->get_qualified_table_name('messages');
    my $user_table = $self->get_qualified_table_name('users');
    
    my $create_message_table = C4::Context->dbh->do("
        CREATE TABLE IF NOT EXISTS `$table` (
            `id` INT( 11 ) NOT NULL AUTO_INCREMENT ,
            `member_id` INT( 11 ) NOT NULL ,
            `member_name` VARCHAR( 255 ) NOT NULL ,
            `message` VARCHAR( 255 ) NOT NULL ,
            `when` INT( 11 ) NOT NULL ,
            PRIMARY KEY ( `id` ) 
          ) ENGINE = InnoDB;
    ");
    
    my $create_user_table = C4::Context->dbh->do("
        CREATE TABLE IF NOT EXISTS `$user_table` (
            `id` INT( 11 ) NOT NULL ,
            `name` VARCHAR( 255 ) NOT NULL ,
            `when` INT( 11 ) NOT NULL ,
            PRIMARY KEY ( `id` )
        ) ENGINE = InnoDB;
    ");
    
    $self->store_data( { motd => '', host => '', is_enabled => 1 } );
    
    return $create_message_table && $create_user_table;
}

## This is the 'upgrade' method. It will be triggered when a newer version of a
## plugin is installed over an existing older version of a plugin
sub upgrade {
    my ( $self, $args ) = @_;

    ## FIXME: dt_from_string is undefined!
    my $dt = dt_from_string();
    $self->store_data( { last_upgraded => $dt->ymd('-') . ' ' . $dt->hms(':') } );
    
    $self->store_data( { motd => '', is_enabled => 1 } );

    return 1;
}

## This method will be run just before the plugin files are deleted
## when a plugin is uninstalled. It is good practice to clean up
## after ourselves!
sub uninstall() {
    my ( $self, $args ) = @_;
    my $table = $self->get_qualified_table_name('messages');
    my $user_table = $self->get_qualified_table_name('users');
	my $uninstall_messages = C4::Context->dbh->do("DROP TABLE IF EXISTS $table");
    my $uninstall_users = C4::Context->dbh->do("DROP TABLE IF EXISTS $user_table");
    return $uninstall_messages && $uninstall_users;
}

sub version() {
    return "$VERSION";
}

sub isChatEnabled() {
    my ( $self, $args ) = @_;
    my $isEnabled = $self->retrieve_data('is_enabled');
    return $isEnabled eq 1;
}

sub dieIfOffline() {
    my ( $self, $args ) = @_;
    if(!$self->isChatEnabled) {
        print("Chat system is offline");
        exit 0;
    }
}