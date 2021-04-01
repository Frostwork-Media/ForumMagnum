import React, {useState} from 'react';
import { Components, registerComponent } from '../../lib/vulcan-lib';
import { useCurrentUser } from '../common/withUser';
import { useUpdateCurrentUser } from '../hooks/useUpdateCurrentUser';
import { userEmailAddressIsVerified, userHasEmailAddress } from '../../lib/collections/users/helpers';
import { useMessages } from '../common/withMessages';
import { getGraphQLErrorID, getGraphQLErrorMessage } from '../../lib/utils/errorUtil';
import SimpleSchema from 'simpl-schema';
import Button from '@material-ui/core/Button';
import Input from '@material-ui/core/Input';
import withErrorBoundary from '../common/withErrorBoundary'

const styles = (theme: ThemeType): JssStyles => ({
  root: {
    marginBottom: theme.spacing.unit*4,
    position: "relative",
    minHeight: 58,
    backgroundColor: "rgba(253,253,253)",
    
    padding: 16,
    ...theme.typography.body2,
    
    border: "1px solid #aaa",
    borderRadius: 10,
    boxShadow: "5px 5px 5px rgba(0,0,0,20%)",
    
    marginLeft: "auto",
    marginRight: "auto",
    maxWidth: 500,
  },
  loginForm: {
    margin: "0 auto",
    maxWidth: 252,
  },
  message: {
    fontSize: 18,
    marginBottom: 18,
  },
  emailInput: {
  },
  subscribeButton: {
    margin: "0 auto",
    display: "block",
    background: "#d2e8d2",
  },
  buttons: {
    marginTop: 16,
    textAlign: "right",
  },
  maybeLaterButton: {
  },
  dontAskAgainButton: {
  },
});

const RecentDiscussionSubscribeReminder = ({classes}: {
  classes: ClassesType,
}) => {
  const currentUser = useCurrentUser();
  const updateCurrentUser = useUpdateCurrentUser();
  const [hide, setHide] = useState(false);
  const [subscribeChecked, setSubscribeChecked] = useState(true);
  const [verificationEmailSent, setVerificationEmailSent] = useState(false);
  const [subscriptionConfirmed, setSubscriptionConfirmed] = useState(false);
  const [emailAddressInput, setEmailAddressInput] = useState("");
  const [loading, setLoading] = useState(false);
  const { flash } = useMessages();
  const {WrappedLoginForm, SignupSubscribeToCurated, Loading} = Components;
  const subscriptionDescription = '(2-3 posts per week, selected by the LessWrong moderation team.)'
  
  const maybeLaterButton = <Button
    className={classes.maybeLaterButton}
    onClick={() => setHide(true)}
  >
    Maybe Later
  </Button>
  
  const dontAskAgainButton = <span>
    {currentUser && <Button
      className={classes.dontAskAgainButton}
      onClick={() => {
        void updateCurrentUser({hideSubscribePoke: true});
        setHide(true)
      }}
    >
      Don't Ask Again
    </Button>}
  </span>
  
  if (hide || currentUser?.hideSubscribePoke) {
    return null;
  }
  
  const updateAndMaybeVerifyEmail = async () => {
    setLoading(true);
    if (!userEmailAddressIsVerified(currentUser)) {
      try {
        await updateCurrentUser({
          whenConfirmationEmailSent: new Date(),
          emailSubscribedToCurated: true,
          unsubscribeFromAll: false,
        });
        setVerificationEmailSent(true);
      } catch(e) {
        flash(getGraphQLErrorMessage(e));
      }
    } else {
      try {
        await updateCurrentUser({
          emailSubscribedToCurated: true,
        });
        setSubscriptionConfirmed(true);
      } catch(e) {
        flash(getGraphQLErrorMessage(e));
      }
    }
    setLoading(false);
  }
  
  const Wrapper = ({children}: {children: React.ReactNode}) => {
    return <div className={classes.root}>
      {children}
    </div>
  }
  
  if (loading) {
    return <Wrapper>
      <Loading/>
    </Wrapper>
  } else if (subscriptionConfirmed) {
    return <Wrapper>
      You are subscribed to the best posts of LessWrong!
    </Wrapper>
  } else if (verificationEmailSent) {
    // Clicked Subscribe in one of the other branches, and a confirmation email
    // was sent. You need to verify your email address to complete the subscription.
    const yourEmail = currentUser?.emails[0]?.address;
    return <Wrapper>
      <div className={classes.message}>
        We sent an email to {yourEmail}. Follow the link in the email to complete your subscription.
      </div>
    </Wrapper>
  } else if (!currentUser) {
    // Not logged in. Show a create-account form and a brief pitch.
    return <Wrapper>
      <div className={classes.message}>
        To get the best posts emailed to you, create an account! {subscriptionDescription}
      </div>
      <div className={classes.loginForm}>
        <WrappedLoginForm startingState="signup" />
      </div>
      <div className={classes.buttons}>
        {maybeLaterButton}
        {dontAskAgainButton}
      </div>
    </Wrapper>
  } else if (!userHasEmailAddress(currentUser)) {
    // Logged in, but no email address associated. Probably a legacy account.
    // Show a text box for an email address, with a submit button and a subscribe
    // checkbox.
    return <Wrapper>
      <div className={classes.message}>
        Your account does not have an email address associated. Add an email address to subscribe to curated posts and enable notifications.
      </div>
      
      <Input placeholder="Email address" onChange={(ev)=>setEmailAddressInput(ev.target.value)} value={emailAddressInput} className={classes.emailInput} />
      <SignupSubscribeToCurated defaultValue={true} onChange={(checked: boolean) => setSubscribeChecked(true)}/>
      
      <div className={classes.buttons}>
        <Button className={classes.subscribeButton} onClick={async (ev) => {
          if (SimpleSchema.RegEx.Email.test(emailAddressInput)) {
            setLoading(true);
            try {
              await updateCurrentUser({
                email: emailAddressInput,
                emailSubscribedToCurated: subscribeChecked,
                unsubscribeFromAll: false,
              });
              // Confirmation-email mutation is separate from the send-verification-email
              // mutation because otherwise it goes to the old email address (aka null)
              await updateCurrentUser({
                whenConfirmationEmailSent: new Date(),
              });
              setVerificationEmailSent(true);
            } catch(e) {
              if (getGraphQLErrorID(e) === "users.email_already_taken") {
                flash("That email address is already taken by a different account.");
              } else {
                flash(e.message || e.id);
              }
            }
            setLoading(false);
          } else {
            flash("Please enter a valid email address.");
          }
        }}>Submit</Button>
        <div className={classes.buttons}>
          {maybeLaterButton}
          {dontAskAgainButton}
        </div>
      </div>
    </Wrapper>
  } else if (currentUser.unsubscribeFromAll) {
    // User has clicked unsubscribe-from-all at some point in the past. Pitch
    // on re-subscribing. A big Subscribe button, which clears the
    // unsubscribe-from-all option, activates curation emails (if not already
    // activated), and sends a confirmation email (if needed).
    return <Wrapper>
      <div className={classes.message}>
        You previously unsubscribed from all emails from LessWrong. Re-subscribe to get the best posts emailed to you! {subscriptionDescription}
      </div>
      <Button className={classes.subscribeButton} onClick={async (ev) => {
        await updateAndMaybeVerifyEmail();
      }}>Subscribe</Button>
      <div className={classes.buttons}>
        <div className={classes.buttons}>
          {maybeLaterButton}
          {dontAskAgainButton}
        </div>
      </div>
    </Wrapper>
  } else if (!currentUser.emailSubscribedToCurated) {
    // User is logged in, and has an email address associated with their
    // account, but is not subscribed to curated posts. A Subscribe button which
    // sets the subscribe-to-curated option, and (if their email address isn't
    // verified) resends the verification email.
    return <Wrapper>
      <div className={classes.message}>
        Subscribe to get the best of LessWrong emailed to you. {subscriptionDescription}
      </div>
      <Button className={classes.subscribeButton} onClick={async (ev) => {
        await updateAndMaybeVerifyEmail();
      }}>Subscribe</Button>
      <div className={classes.buttons}>
        {maybeLaterButton}
        {dontAskAgainButton}
      </div>
    </Wrapper>
  } else if (!userEmailAddressIsVerified(currentUser)) {
    // User is subscribed, but they haven't verified their email address. Show
    // a resend-verification-email button.
    return <Wrapper>
      {!verificationEmailSent && <div>
        <div className={classes.message}>
          Please verify your email address to activate your subscription to curated posts.
        </div>
        <div className={classes.buttons}>
          <Button className={classes.subscribeButton} onClick={async (ev) => {
            setLoading(true);
            try {
              await updateCurrentUser({
                whenConfirmationEmailSent: new Date()
              });
            } catch(e) {
              flash(getGraphQLErrorMessage(e));
            }
            setLoading(false);
            setVerificationEmailSent(true);
          }}>Resend Verification Email</Button>
          <div className={classes.buttons}>
            {maybeLaterButton}
            {dontAskAgainButton}
          </div>
        </div>
      </div>}
      {verificationEmailSent && <div>
        <div className={classes.message}>
          Verification email sent. Check your email.
        </div>
      </div>}
    </Wrapper>
  } else {
    // Everything looks good-already subscribed to curated. No need to show anything.
    return null;
  }
}

const RecentDiscussionSubscribeReminderComponent = registerComponent(
  'RecentDiscussionSubscribeReminder', RecentDiscussionSubscribeReminder, {
    styles,
    hocs: [withErrorBoundary],
  }
);

declare global {
  interface ComponentTypes {
    RecentDiscussionSubscribeReminder: typeof RecentDiscussionSubscribeReminderComponent,
  }
}
