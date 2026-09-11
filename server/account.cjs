function accountType(email, role = "user") {
  if (role === "admin") return "admin";
  const value = String(email || "").trim().toLowerCase();
  if (/^a\d+@alumnos\.uat\.edu\.mx$/.test(value)) return "student";
  if (/@docentes\.uat\.edu\.mx$/.test(value)) return "teacher";
  if (/@uat\.edu\.mx$/.test(value) && !/@alumnos\.uat\.edu\.mx$/.test(value))
    return "teacher";
  return "other";
}
function isStudent(user) {
  return accountType(user?.email, user?.role) === "student";
}
function isTeacher(user) {
  const type = accountType(user?.email, user?.role);
  return type === "teacher" || type === "admin";
}
module.exports = { accountType, isStudent, isTeacher };
