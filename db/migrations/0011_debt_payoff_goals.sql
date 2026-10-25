ALTER TABLE `goals` ADD `linked_account_id` text;--> statement-breakpoint
ALTER TABLE `goals` ADD `direction` text DEFAULT 'increase' NOT NULL;--> statement-breakpoint
-- Convert a goal only when its wording is a full payoff (target becomes £0) and the
-- debt it refers to is unambiguous. The stored target was the amount to clear, so it
-- becomes the starting balance. Anything completed, life-metric, growth-oriented,
-- "reduce to £X", or tied to more than one possible loan is left for the user to edit.
UPDATE `goals`
SET
  `metric_type` = 'DEBT_PAYOFF',
  `direction` = 'decrease',
  `linked_metric_id` = NULL,
  `linked_category` = NULL,
  `baseline_value` = CASE
    WHEN `target_value` > 0 THEN `target_value`
    ELSE `baseline_value`
  END,
  `baseline_date` = CASE
    WHEN `target_value` > 0 THEN date(`created_at`)
    ELSE `baseline_date`
  END,
  `target_value` = 0,
  `linked_account_id` = (
    SELECT `match`.`id`
    FROM (
      SELECT `a`.`id` AS `id`, 1 AS `rank`
      FROM `accounts` AS `a`
      WHERE `a`.`type` = 'LIABILITY'
        AND length(trim(`a`.`name`)) >= 8
        AND lower(`goals`.`name`) LIKE '%' || lower(`a`.`name`) || '%'
        AND (
          SELECT count(*)
          FROM `accounts` AS `a2`
          WHERE `a2`.`type` = 'LIABILITY'
            AND length(trim(`a2`.`name`)) >= 8
            AND lower(`goals`.`name`) LIKE '%' || lower(`a2`.`name`) || '%'
        ) = 1
      UNION ALL
      SELECT `a`.`id`, 2
      FROM `accounts` AS `a`
      WHERE `a`.`type` = 'LIABILITY'
        AND `a`.`category` = 'STUDENT_LOAN'
        AND (
          lower(`goals`.`name`) LIKE '%student%'
          OR lower(ifnull(`goals`.`description`, '')) LIKE '%student%'
        )
        AND (
          SELECT count(*)
          FROM `accounts`
          WHERE `type` = 'LIABILITY' AND `category` = 'STUDENT_LOAN'
        ) = 1
      UNION ALL
      SELECT `a`.`id`, 3
      FROM `accounts` AS `a`
      WHERE `a`.`type` = 'LIABILITY'
        AND (SELECT count(*) FROM `accounts` WHERE `type` = 'LIABILITY') = 1
    ) AS `match`
    ORDER BY `match`.`rank`
    LIMIT 1
  )
WHERE `completed_at` IS NULL
  AND `metric_type` != 'LIFE_METRIC'
  AND `metric_type` != 'DEBT_PAYOFF'
  AND lower(`name`) NOT LIKE '%net worth%'
  AND lower(`name`) NOT LIKE '%saving%'
  AND lower(`name`) NOT LIKE '%invest%'
  AND lower(`name`) NOT LIKE '%reach%'
  AND lower(`name`) NOT LIKE '%down to%'
  AND lower(`name`) NOT LIKE '% to £%'
  AND lower(`name`) NOT LIKE '% to gbp%'
  AND lower(`name`) NOT LIKE '%remain%'
  AND lower(`name`) NOT LIKE '%under %'
  AND lower(`name`) NOT LIKE '%below %'
  AND (
    (
      (
        lower(`name`) LIKE '%pay off%'
        OR lower(`name`) LIKE '%payoff%'
        OR lower(`name`) LIKE '%paid off%'
        OR lower(`name`) LIKE '%paying off%'
        OR lower(`name`) LIKE '%pay this off%'
        OR lower(`name`) LIKE '%pay it off%'
        OR lower(`name`) LIKE '%repay%'
        OR lower(`name`) LIKE '%pay down%'
        OR lower(`name`) LIKE '%paying down%'
        OR lower(`name`) LIKE '%debt free%'
        OR lower(`name`) LIKE '%debt-free%'
        OR (
          (
            lower(`name`) LIKE '%clear %'
            OR lower(`name`) LIKE '%cleared%'
            OR lower(`name`) LIKE '%clearing%'
          )
          AND (
            lower(`name`) LIKE '%loan%'
            OR lower(`name`) LIKE '%debt%'
            OR lower(`name`) LIKE '%mortgage%'
          )
        )
      )
      AND (
        lower(`name`) LIKE '%loan%'
        OR lower(`name`) LIKE '%debt%'
        OR lower(`name`) LIKE '%mortgage%'
        OR lower(`name`) LIKE '%overdraft%'
        OR lower(`name`) LIKE '%credit card%'
        OR lower(`name`) LIKE '%student%'
      )
    )
    OR (
      (
        lower(ifnull(`description`, '')) LIKE '%pay off%'
        OR lower(ifnull(`description`, '')) LIKE '%payoff%'
        OR lower(ifnull(`description`, '')) LIKE '%paid off%'
        OR lower(ifnull(`description`, '')) LIKE '%paying off%'
        OR lower(ifnull(`description`, '')) LIKE '%pay this off%'
        OR lower(ifnull(`description`, '')) LIKE '%pay it off%'
        OR lower(ifnull(`description`, '')) LIKE '%repay%'
        OR lower(ifnull(`description`, '')) LIKE '%debt free%'
        OR lower(ifnull(`description`, '')) LIKE '%debt-free%'
      )
      AND (
        lower(`name`) LIKE '%loan%'
        OR lower(`name`) LIKE '%debt%'
        OR lower(`name`) LIKE '%mortgage%'
        OR lower(`name`) LIKE '%student%'
      )
    )
  )
  AND (SELECT count(*) FROM `accounts` WHERE `type` = 'LIABILITY') >= 1
  AND (
    (SELECT count(*) FROM `accounts` WHERE `type` = 'LIABILITY') = 1
    OR lower(`name`) LIKE '%debt free%'
    OR lower(`name`) LIKE '%debt-free%'
    OR lower(`name`) LIKE '%all debt%'
    OR lower(`name`) LIKE '%all debts%'
    OR lower(`name`) LIKE '%my debts%'
    OR lower(ifnull(`description`, '')) LIKE '%all debt%'
    OR lower(ifnull(`description`, '')) LIKE '%all debts%'
    OR EXISTS (
      SELECT 1
      FROM `accounts` AS `a`
      WHERE `a`.`type` = 'LIABILITY'
        AND length(trim(`a`.`name`)) >= 8
        AND lower(`goals`.`name`) LIKE '%' || lower(`a`.`name`) || '%'
        AND (
          SELECT count(*)
          FROM `accounts` AS `a2`
          WHERE `a2`.`type` = 'LIABILITY'
            AND length(trim(`a2`.`name`)) >= 8
            AND lower(`goals`.`name`) LIKE '%' || lower(`a2`.`name`) || '%'
        ) = 1
    )
    OR (
      (
        lower(`name`) LIKE '%student%'
        OR lower(ifnull(`description`, '')) LIKE '%student%'
      )
      AND (
        SELECT count(*)
        FROM `accounts`
        WHERE `type` = 'LIABILITY' AND `category` = 'STUDENT_LOAN'
      ) = 1
    )
  );