(() => {
  const users = JSON.parse(localStorage.getItem("scheduler_users") || "[]");
  const data = {};

  Object.keys(localStorage)
    .filter((key) => key.startsWith("scheduler_data_"))
    .forEach((key) => {
      try {
        data[key] = JSON.parse(localStorage.getItem(key));
      } catch {
        data[key] = null;
      }
    });

  const exportData = {
    scheduler_users: users,
    ...data,
  };

  const blob = new Blob([JSON.stringify(exportData, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "scheduler-local-data.json";
  link.click();
  URL.revokeObjectURL(url);

  console.log("Exported scheduler_users and scheduler_data_<userId>. LocalStorage was not modified.");
})();
