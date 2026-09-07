package com.home.Repository;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.home.Domain.RetirementProfile;

@Repository
public interface RetirementProfileRepository extends JpaRepository<RetirementProfile, Long> {

	Optional<RetirementProfile> findByUserId(Long userId);
}
