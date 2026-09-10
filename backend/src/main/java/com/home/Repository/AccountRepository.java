package com.home.Repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.home.Domain.Account;

@Repository
public interface AccountRepository extends JpaRepository<Account, Long> {
	List<Account> findByUserIdOrderByIdAsc(Long userId);
	Optional<Account> findByUserIdAndName(Long userId, String name);
}
