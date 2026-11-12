// Строки Scrum-доски команды (#/dev).
export const DEV = {
  kk: {
    dev: { title: "Scrum", sprint: (n) => `${n}-спринт`, progress: (a, b) => `Дайын: ${a} / ${b} ұпай`, all: "Барлығы",
      closeSprint: "Спринтті жабу", confirmClose: (n) => `Спринтті жабу керек пе? ${n} дайын карточка мұрағатқа өтеді.`,
      closed: (n, k, p) => `${n}-спринт жабылды: ${k} тапсырма, ${p} ұпай`, history: "Жабылған спринттер", pt: "ұп.",
      cols: { backlog: "Бэклог", todo: "Орындауға", doing: "Жұмыста", review: "Тексеруде", done: "Дайын" },
      labels: { feature: "Мүмкіндік", bug: "Қате", design: "Дизайн", content: "Контент", infra: "Инфра" },
      add: "Карточка қосу", newTitle: "Тапсырма атауы", cancel: "Болдырмау", name: "Атауы", description: "Сипаттама",
      column: "Баған", assignee: "Орындаушы", points: "Story points", label: "Белгі", save: "Сақтау", delete: "Жою",
      confirmDelete: "Карточканы жою керек пе?" },
    docs: { title: "Өнім жоспары", tabs: { plan: "V0 жоспары", competitors: "Бәсекелестер", architecture: "Архитектура" },
      source: "docs/ ішіндегі файлдардан — git-тегі өзгеріс деплойдан кейін осында шығады" },
  },
  ru: {
    dev: { title: "Scrum", sprint: (n) => `Спринт ${n}`, progress: (a, b) => `Готово: ${a} из ${b} очков`, all: "Все",
      closeSprint: "Закрыть спринт", confirmClose: (n) => `Закрыть спринт? ${n} готовых карточек уйдут в архив.`,
      closed: (n, k, p) => `Спринт ${n} закрыт: ${k} задач, ${p} очков`, history: "Закрытые спринты", pt: "оч.",
      cols: { backlog: "Бэклог", todo: "К работе", doing: "В работе", review: "На проверке", done: "Готово" },
      labels: { feature: "Фича", bug: "Баг", design: "Дизайн", content: "Контент", infra: "Инфра" },
      add: "Добавить карточку", newTitle: "Название задачи", cancel: "Отмена", name: "Название", description: "Описание",
      column: "Колонка", assignee: "Исполнитель", points: "Story points", label: "Метка", save: "Сохранить", delete: "Удалить",
      confirmDelete: "Удалить карточку?" },
    docs: { title: "План продукта", tabs: { plan: "План V0", competitors: "Конкуренты", architecture: "Архитектура" },
      source: "Из файлов docs/ — правка в git появится здесь после деплоя" },
  },
};
