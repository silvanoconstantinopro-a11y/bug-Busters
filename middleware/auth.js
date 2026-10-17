function requireAuth(req, res, next) {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ error: 'Não autenticado.' });
  }
  next();
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.session || !req.session.userId) {
      return res.status(401).json({ error: 'Não autenticado.' });
    }
    if (!roles.includes(req.session.role)) {
      return res.status(403).json({ error: 'Sem permissão.' });
    }
    next();
  };
}

module.exports = { requireAuth, requireRole };