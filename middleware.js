// backend/middleware.js

const jwt = require('jsonwebtoken');
const { User } = require('./models');

// =================================================================
// 1. MIDDLEWARE DE AUTENTICAÇÃO (protect)
// =================================================================
// Este middleware protege as rotas, garantindo que apenas usuários
// autenticados possam acessá-las.
const protect = async (req, res, next) => {
  let token;

  // Verifica se o cabeçalho de autorização existe e começa com "Bearer"
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      // 1. Extrai o token do cabeçalho (formato "Bearer <token>")
      token = req.headers.authorization.split(' ')[1];

      // 2. Verifica se o token é válido e decodifica o payload (que contém o ID do usuário)
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // 3. Busca o usuário no banco de dados pelo ID contido no token
      // O '-password' remove o campo da senha do resultado da busca por segurança.
      req.user = await User.findById(decoded.id).select('-password');

      if (!req.user) {
        return res.status(401).json({ message: 'Usuário não encontrado.' });
      }

      // 4. Passa para o próximo middleware ou rota
      next();
    } catch (error) {
      console.error(error);
      // Se o token for inválido (expirado, malformado), um erro será lançado.
      res.status(401).json({ message: 'Não autorizado, token inválido.' });
    }
  }

  if (!token) {
    res.status(401).json({ message: 'Não autorizado, nenhum token fornecido.' });
  }
};


// =================================================================
// 2. MIDDLEWARE DE AUTORIZAÇÃO DE ADMIN (isAdmin)
// =================================================================
// Este middleware deve ser usado DEPOIS do middleware 'protect'.
// Ele verifica se o usuário logado (req.user) tem a permissão de 'admin'.
const isAdmin = (req, res, next) => {
  // O middleware 'protect' já deve ter anexado os dados do usuário a 'req.user'
  if (req.user && req.user.role === 'admin') {
    // Se o usuário é um admin, permite que a requisição continue
    next();
  } else {
    // Se não for admin, retorna um erro de 'Forbidden' (Proibido)
    res.status(403).json({ message: 'Acesso negado. Rota exclusiva para administradores.' });
  }
};

module.exports = { protect, isAdmin };