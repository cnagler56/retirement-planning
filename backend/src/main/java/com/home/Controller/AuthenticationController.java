package com.home.Controller;

import java.time.Duration;

import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CookieValue;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import com.home.Domain.LoginDTO;
import com.home.Domain.User;
import com.home.Service.SessionService;
import com.home.Service.UserService;

/**
 * Cookie-session auth. Register / login mint a server-side session and set an
 * HttpOnly cookie; /me resolves the current user from it; /logout clears it.
 *
 * The cookie is HttpOnly + SameSite=Lax so JS can't read it and it still rides
 * on top-level navigations. In production (HTTPS) set COOKIE_SECURE=true.
 */
@RestController
@CrossOrigin(origins = "http://localhost:3000", allowCredentials = "true")
public class AuthenticationController {

	private final UserService userService;
	private final SessionService sessionService;

	public AuthenticationController(UserService userService, SessionService sessionService) {
		this.userService = userService;
		this.sessionService = sessionService;
	}

	@PostMapping("/register")
	public ResponseEntity<User> register(@RequestBody LoginDTO request) {
		User user = userService.register(request);
		String token = sessionService.createSession(user.getUserId());
		return ResponseEntity.status(HttpStatus.CREATED)
			.header(HttpHeaders.SET_COOKIE, sessionCookie(token).toString())
			.body(user);
	}

	@PostMapping("/login")
	public ResponseEntity<User> login(@RequestBody LoginDTO request) {
		User user = userService.authenticate(request);
		String token = sessionService.createSession(user.getUserId());
		return ResponseEntity.ok()
			.header(HttpHeaders.SET_COOKIE, sessionCookie(token).toString())
			.body(user);
	}

	/** Returns the user attached to the current session cookie, or 401. */
	@GetMapping("/me")
	public User me(@CookieValue(name = SessionService.COOKIE_NAME, required = false) String token) {
		return sessionService.findUserByToken(token)
			.orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Not signed in"));
	}

	@PostMapping("/logout")
	public ResponseEntity<Void> logout(
			@CookieValue(name = SessionService.COOKIE_NAME, required = false) String token) {
		sessionService.invalidate(token);
		return ResponseEntity.noContent()
			.header(HttpHeaders.SET_COOKIE, expiredCookie().toString())
			.build();
	}

	private ResponseCookie sessionCookie(String token) {
		return ResponseCookie.from(SessionService.COOKIE_NAME, token)
			.httpOnly(true)
			.secure(false)          // set true behind HTTPS in prod
			.sameSite("Lax")
			.path("/")
			.maxAge(Duration.ofDays(30))
			.build();
	}

	private ResponseCookie expiredCookie() {
		return ResponseCookie.from(SessionService.COOKIE_NAME, "")
			.httpOnly(true)
			.secure(false)
			.sameSite("Lax")
			.path("/")
			.maxAge(0)
			.build();
	}
}
