package com.home;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class RetireServerApplication {

	public static void main(String[] args) {
		SpringApplication.run(RetireServerApplication.class, args);
		System.out.println("..........................Retirement Planner running........................");
	}

}
