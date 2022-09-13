function displayScreen(screenId) {
  window.event?.preventDefault?.();
  // Create the promise, because this fn is async
  return new Promise(async resolve => {
    // Getting the elements we need
    const screenToShow = document.getElementById(screenId);
    const currentlyShownScreen = document.getElementsByClassName("visible")[0];
    
    // Built-in animate() procedure allows us to animate DOM elements
    currentlyShownScreen.animate([
      {opacity: 1},
      {opacity: 0, transform: "translateX(50vw)"}
    ], {
      duration: 220,
      iterations: 1
    });
    
    // Sleep for some time, the duration of the animation
    await (() => {
      return new Promise(sleep => {
        setTimeout(sleep, 220);
      });
    })();
    // After the animation is done, remove the "visible" class
    
    currentlyShownScreen.classList.remove("visible");
    
    
    // Now, we need to show the screen with the id screenId
    screenToShow.classList.add("visible");
    screenToShow.animate([
      {opacity: 0, transform: "translateX(-50vw)"},
      {opacity: 1}
    ],{
      duration: 220,
      iterations: 1
    });
    
    // wait for this animation to end...
    (() => {
      return new Promise(() => {
        // ...and then resolve the outer promise
        setTimeout(resolve, 220);
      });
    })();
    
  });
}



setTimeout(() => {
  Array.from(document.forms.loginForm.children).forEach(el => {
    el.setAttribute("value", el.getAttribute("value") || "");
  });
  console.log("Form validity updated");
}, 1500);




async function loginBtnClick() {
	// first get all of the data required
	// to log a user in
	const storePasswordCheck = document.getElementById("rememberMeLogin");
	const usernameOrEmailInput = document.getElementById("usernameOrEmail");
	const passwordAttemptInput = document.getElementById("enterPassword");

	// if any input is invalid, stop
	if(!(usernameOrEmailInput.checkValidity() && passwordAttemptInput.checkValidity())) {
		console.log("Invalid input");
		return;
	}

	// inputs are valid, sent to server
	// start loading effect
	const target = window.event.target;
	target.style.opacity = .5;
	target.style.pointerEvents = "none";

	const loginResult = await $.ajax("https://shy-plum-bass-slip.cyclic.app/log-in", {
		method: "POST",
		cache: false,
		data: {
			usernameOrEmail: usernameOrEmailInput.value,
			password: passwordAttemptInput.value
		}
	});

  parseResponse(loginResult);

	target.style.opacity = 1;
	target.style.pointerEvents = "";
}
async function signUpBtnClick() {
  // first get all of the data required
  // to log a user in
  const usernameInput = document.getElementById("usernameInput");
  const emailInput = document.getElementById("emailInput");
  const passwordInput = document.getElementById("createPassword");

  // if any input is invalid, stop
  if(!(usernameInput.checkValidity() && emailInput.checkValidity() && passwordInput.checkValidity())) {
    console.log("Invalid input");
    return;
  }


  // inputs are valid, sent to server
  // start loading effect
  const target = window.event.target;
  target.style.opacity = .5;
  target.style.pointerEvents = "none";

  const newAccResult = await $.ajax("https://shy-plum-bass-slip.cyclic.app/create-new-account", {
    method: "POST",
    cache: false,
    data: {
      username: usernameInput.value,
      email: emailInput.value,
      password: passwordInput.value,
    }
  });

  // todo: display message depending on newAccResult
  parseResponse(newAccResult);



  target.style.opacity = 1;
  target.style.pointerEvents = "";
}



function parseResponse(response) {
  const {success, message} = response;

  let toastMsg;

  if(success) {
    switch(message) {
      case "create-new-account-success": {
        toastMsg = "Your account has been created successfully. You can now sign in or create another account";
        document.getElementById("signupForm").reset();
        break;
      }
      case "user-logged-in": {
        toastMsg = "Logged in";
        localStorage.setItem("jwt", response.jwt);
        if(document.getElementById("rememberMeLogin").checked) {
          localStorage.setItem("cached-username", document.getElementById("usernameOrEmail").value);
        } else {
          localStorage.removeItem("cached-username");
        }
        const query = new URLSearchParams(location.search);
        redirect(query.get("continue") || "../game");
        break;
      }
      case "account-deleted": {
        toastMsg = "The account was deleted successfully";
        break;
      }
      case "session-generation": {
        toastMsg = "The session was generated successfully. Sending email to your inbox...";
        localStorage.setItem("usid", response.usid);
        sendEmailRequest(response.usid);
        break;
      }
      case "email-sent": {
        toastMsg = "The email with your OTP was sent - check your inbox, and enter the OTP here.";
        showEnterOtpScreen();
        break;
      }
      case "session-opened": {
        toastMsg = "The OTP was correct - you may now choose your new password";
        showEnterNewPasswordScreen();
        break;
      }
      case "password-updated": {
        toastMsg = "Your password has been updated - you may now log in.";
        displayScreen("loginForm");
        break;
      }

      default: {
        toastMsg = message;
        break;
      }
    }
  } else {
    switch(message) {
      case "must-be-logged-in": {
        toastMsg = "You must log in to do that action";
        break;
      }
      case "create-new-account-error": {
        toastMsg = "Error while creating an account, try again later";
        break;
      }
      case "account-locked": {
        toastMsg = "Could not complete that action as the account is locked for a few minutes.";
        break;
      }
      case "wrong-credentials": {
        toastMsg = "That combination of credentials does not exist";
        break;
      }
      case "unknown-error": {
        toastMsg = "An unknown error occured, try again later";
        break;
      }
      case "session-generation": {
        toastMsg = "Database-side error while generating your session. Please try again";
        break;
      }
      case "session-unavailable": {
        toastMsg = "The session you are trying to access is no longer available";
        break;
      }
      case "email-sent": {
        toastMsg = "The email could not be sent. Check for typos in your address and try again";
        break;
      }
      case "session-expired": {
        toastMsg = "Your session has expired, please create a new session and try again";
        break;
      }
      case "wrong-otp": {
        toastMsg = "That OTP did not match our records; the session has been shut down for your own safety";
        displayScreen("loginForm");
        break;
      }
      case "db-error": {
        toastMsg = "An error occured at our database. Please try agian a little later";
        break;
      }
      case "email-not-found": {
        toastMsg = "We couldn't find the email address you enterd";
        break;
      }
      default: {
        toastMsg = message;
        break;
      }
    }
  }

  displayToast(success, toastMsg);
}



function displayToast(success, msg) {
  const toast = new Toast({
    text: msg,
    position: "top-center",
    pauseOnHover: true,
    pauseOnFocusLoss: true,
    success,
    autoClose: 15000
  });
}



function redirect(relativePath) {
  // relativePath could be "../" or "/folder/page.html",
  // for example

  location.assign(relativePath);

}

function requestNewUsid(btn) {
  const username = btn.form.username.value;

  if(! btn.form.username.checkValidity()) {
    return;
  }

  $.ajax("https://shy-plum-bass-slip.cyclic.app/create-reset-password-session", {
    method: "POST",
    cache: false, 
    data: {
      username
    }
  })
  .then(response => {
    parseResponse(response);
  })
  .catch(err => {
    displayToast(false, "An error occured while contacting the server.\
      Please ensure you have a stable Internet connection.");
  });
}
function sendEmailRequest(usid) {
  $.ajax("https://shy-plum-bass-slip.cyclic.app/send-otp-for-usid", {
    method: "POST",
    cache: false, 
    data: {
      usid
    }
  })
  .then(response => {
    parseResponse(response);
  })
  .catch(err => {
    displayToast(false, "An error occured while contacting the server.\
      Please ensure you have a stable Internet connection.");
  });
}
function sendOtpToServer(btn) {

  const otp = btn.form.otp.value;

  if(! btn.form.otp.checkValidity()) {
    return;
  }

  $.ajax("https://shy-plum-bass-slip.cyclic.app/validate-otp-attempt", {
    method: "POST",
    cache: false, 
    data: {
      otp,
      usid: localStorage.getItem("usid")
    }
  })
  .then(response => {
    parseResponse(response);
  })
  .catch(err => {
    displayToast(false, "An error occured while contacting the server.\
      Please ensure you have a stable Internet connection.");
  });
}
function sendNewPasswordToServer(btn) {
  const newPassword = btn.form.password.value;

  if(! btn.form.password.checkValidity()) {
    return;
  }

  $.ajax("https://shy-plum-bass-slip.cyclic.app/set-new-password", {
    method: "POST",
    cache: false, 
    data: {
      password: newPassword,
      usid: localStorage.getItem("usid")
    }
  })
  .then(response => {
    parseResponse(response);
  })
  .catch(err => {
    displayToast(false, "An error occured while contacting the server.\
      Please ensure you have a stable Internet connection.");
  });
}



function showForgotPasswordScreen() {
  displayScreen("forgotPasswordForm");
}
function showEnterOtpScreen() {
  displayScreen("enterOtpForm");
}
function showEnterNewPasswordScreen() {
  displayScreen("chooseNewPasswordForm");
}








const searchParams = new URLSearchParams(location.search);
if(searchParams.get("action")?.includes?.("reset-password")) {
  showForgotPasswordScreen();
}


const cachedUsername = localStorage.getItem("cached-username");
if(cachedUsername != null) {
  document.getElementById("rememberMeLogin").checked = true;
  document.getElementById("usernameOrEmail").value = cachedUsername;
}