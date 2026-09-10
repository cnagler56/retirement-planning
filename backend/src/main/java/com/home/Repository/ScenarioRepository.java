package com.home.Repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.home.Domain.Scenario;

@Repository
public interface ScenarioRepository extends JpaRepository<Scenario, Long> {
	List<Scenario> findByUserIdOrderByIdAsc(Long userId);
}
