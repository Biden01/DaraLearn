"""Правила ежедневного плана. Меняются только новой версией (PLAN.md пилота: объём одинаков каждый день)."""
RULES_VERSION = "plan-v1"

TUTOR_MIN = 18      # занятие с Tutor (15–20)
PRACTICE_MIN = 12   # закрепление (10–15)
CHECK_MIN = 5       # мини-проверка
TOTAL_MIN = TUTOR_MIN + PRACTICE_MIN + CHECK_MIN

PRACTICE_TASKS = 4  # 3–5 заданий: текущая тема + 1–2 слабых пройденных навыка
WEAK_SKILLS = 2
CHECK_TASKS = 3     # 2–3 задания без подсказок

CARRY_DAYS = 3      # невыполненное за последние дни идёт в приоритет

# Выполнение плана: ниже порога или столько дней без единого выполненного пункта — очередь куратора.
ADHERENCE_DAYS = 7
ADHERENCE_LIMIT = 0.3
ADHERENCE_MISSES = 3
