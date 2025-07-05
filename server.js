// backend/server.js

// =================================================================
// 1. IMPORTAÇÕES E CONFIGURAÇÃO INICIAL
// =================================================================
require('dotenv').config(); // Carrega as variáveis de ambiente do arquivo .env
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { check, validationResult } = require('express-validator');
const cloudinary = require('cloudinary').v2;

// Importações locais
const { User, Product, Order } = require('./models');
const { protect, isAdmin } = require('./middleware');
const upload = require('./cloudinaryConfig');

const app = express();
const PORT = process.env.PORT || 5000;

// =================================================================
// 2. MIDDLEWARES GLOBAIS
// =================================================================
app.use(cors()); // Permite requisições de diferentes origens (essencial para o frontend React)
app.use(express.json()); // Habilita o parsing de JSON no corpo das requisições
app.use(express.urlencoded({ extended: true })); // Habilita o parsing de dados de formulário

// =================================================================
// 3. CONEXÃO COM O BANCO DE DADOS (MONGODB ATLAS)
// =================================================================
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('MongoDB conectado com sucesso.'))
.catch(err => console.error('Erro ao conectar ao MongoDB:', err));

// =================================================================
// 4. FUNÇÃO AUXILIAR PARA GERAR TOKEN JWT
// =================================================================
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: '30d', // O token expira em 30 dias
  });
};

// =================================================================
// 5. ROTAS DA API
// =================================================================

// -------------------- ROTAS DE AUTENTICAÇÃO --------------------
// [POST] /api/auth/register - Registrar um novo usuário
app.post('/api/auth/register', [
    check('name', 'O nome é obrigatório').not().isEmpty(),
    check('email', 'Por favor, inclua um email válido').isEmail(),
    check('password', 'A senha deve ter 6 ou mais caracteres').isLength({ min: 6 }),
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const { name, email, password } = req.body;

    try {
        let user = await User.findOne({ email });
        if (user) {
            return res.status(400).json({ message: 'Este email já está em uso.' });
        }

        user = new User({ name, email, password });
        await user.save();
        
        // Retorna o usuário e o token
        res.status(201).json({
            _id: user._id,
            name: user.name,
            email: user.email,
            role: user.role,
            token: generateToken(user._id),
        });
    } catch (error) {
        console.error(error.message);
        res.status(500).send('Erro no servidor');
    }
});

// [POST] /api/auth/login - Autenticar um usuário e obter o token
app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;

    try {
        const user = await User.findOne({ email }).select('+password'); // Inclui a senha na busca
        if (!user || !(await bcrypt.compare(password, user.password))) {
            return res.status(401).json({ message: 'Credenciais inválidas.' });
        }

        if (!user.isActive) {
            return res.status(403).json({ message: 'Esta conta foi desativada.' });
        }

        res.json({
            _id: user._id,
            name: user.name,
            email: user.email,
            role: user.role,
            token: generateToken(user._id),
        });
    } catch (error) {
        console.error(error.message);
        res.status(500).send('Erro no servidor');
    }
});

// [GET] /api/auth/me - Obter dados do usuário logado
app.get('/api/auth/me', protect, (req, res) => {
    res.json(req.user); // req.user é populado pelo middleware 'protect'
});


// -------------------- ROTAS DE PRODUTOS --------------------
// [POST] /api/products - Criar um novo produto (Admin)
app.post('/api/products', protect, isAdmin, upload.single('image'), [
    check('name', 'Nome é obrigatório').not().isEmpty(),
    check('description', 'Descrição é obrigatória').not().isEmpty(),
    check('price', 'Preço é obrigatório e deve ser um número').isNumeric(),
    check('category', 'Categoria é obrigatória').not().isEmpty(),
    check('stock', 'Estoque é obrigatório').not().isEmpty(),
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    if (!req.file) {
        return res.status(400).json({ message: 'A imagem do produto é obrigatória.' });
    }
    
    try {
        const { name, description, price, category, stock } = req.body;
        // O stock vem como string, precisamos converter para objeto
        const parsedStock = JSON.parse(stock);

        const newProduct = new Product({
            name,
            description,
            price,
            category,
            stock: parsedStock,
            imageUrl: req.file.path, // URL segura do Cloudinary
            cloudinary_id: req.file.filename, // ID para futura exclusão
        });

        const product = await newProduct.save();
        res.status(201).json(product);
    } catch (error) {
        console.error(error);
        res.status(500).send('Erro no servidor');
    }
});

// [GET] /api/products - Listar todos os produtos (Público, com filtros)
app.get('/api/products', async (req, res) => {
    const pageSize = 12;
    const page = Number(req.query.pageNumber) || 1;
    
    const keyword = req.query.keyword ? { name: { $regex: req.query.keyword, $options: 'i' } } : {};
    const category = req.query.category ? { category: req.query.category } : {};

    try {
        const count = await Product.countDocuments({ ...keyword, ...category });
        const products = await Product.find({ ...keyword, ...category })
            .limit(pageSize)
            .skip(pageSize * (page - 1));

        res.json({ products, page, pages: Math.ceil(count / pageSize) });
    } catch (error) {
        console.error(error);
        res.status(500).send('Erro no servidor');
    }
});

// [GET] /api/products/:id - Obter um único produto (Público)
app.get('/api/products/:id', async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);
        if (!product) {
            return res.status(404).json({ message: 'Produto não encontrado.' });
        }
        res.json(product);
    } catch (error) {
        console.error(error);
        res.status(500).send('Erro no servidor');
    }
});

// [PUT] /api/products/:id - Atualizar um produto (Admin)
app.put('/api/products/:id', protect, isAdmin, upload.single('image'), async (req, res) => {
    try {
        let product = await Product.findById(req.params.id);
        if (!product) {
            return res.status(404).json({ message: 'Produto não encontrado.' });
        }
        
        // Atualiza os campos
        const { name, description, price, category, stock } = req.body;
        product.name = name || product.name;
        product.description = description || product.description;
        product.price = price || product.price;
        product.category = category || product.category;
        if (stock) {
          product.stock = JSON.parse(stock);
        }
        
        // Se uma nova imagem foi enviada, atualiza e deleta a antiga do Cloudinary
        if (req.file) {
            await cloudinary.uploader.destroy(product.cloudinary_id);
            product.imageUrl = req.file.path;
            product.cloudinary_id = req.file.filename;
        }

        const updatedProduct = await product.save();
        res.json(updatedProduct);
    } catch (error) {
        console.error(error);
        res.status(500).send('Erro no servidor');
    }
});

// [DELETE] /api/products/:id - Deletar um produto (Admin)
app.delete('/api/products/:id', protect, isAdmin, async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);
        if (!product) {
            return res.status(404).json({ message: 'Produto não encontrado.' });
        }

        // Deleta a imagem do Cloudinary antes de deletar o produto do DB
        await cloudinary.uploader.destroy(product.cloudinary_id);
        await product.deleteOne(); // Usar deleteOne() ao invés de remove()

        res.json({ message: 'Produto removido com sucesso.' });
    } catch (error) {
        console.error(error);
        res.status(500).send('Erro no servidor');
    }
});


// -------------------- ROTAS DE PEDIDOS --------------------
// [POST] /api/orders - Criar um novo pedido (Cliente)
app.post('/api/orders', protect, async (req, res) => {
    const { orderItems, shippingAddress, totalAmount } = req.body;

    if (!orderItems || orderItems.length === 0) {
        return res.status(400).json({ message: 'Nenhum item no pedido.' });
    }

    try {
        // Validação e atualização de estoque (simples, para produção seria mais robusto)
        for (const item of orderItems) {
            const product = await Product.findById(item.product);
            const stockItem = product.stock.find(s => s.size === item.size);
            if (!stockItem || stockItem.quantity < item.quantity) {
                return res.status(400).json({ message: `Estoque insuficiente para ${product.name} (Tamanho: ${item.size})`});
            }
            stockItem.quantity -= item.quantity;
            await product.save();
        }

        const order = new Order({
            user: req.user._id,
            products: orderItems.map(item => ({...item, product: item.product })),
            shippingAddress,
            totalAmount,
            // Detalhes do pagamento M-Pesa simulado
            paymentDetails: {
                method: 'M-Pesa',
                transactionId: `MPESA_${Date.now()}`, // ID simulado
                paymentStatus: 'Completed' // Simula pagamento completo
            }
        });

        const createdOrder = await order.save();
        res.status(201).json(createdOrder);

    } catch (error) {
        console.error(error);
        res.status(500).send('Erro no servidor');
    }
});

// [GET] /api/orders/my-orders - Listar pedidos do usuário logado (Cliente)
app.get('/api/orders/my-orders', protect, async (req, res) => {
    try {
        const orders = await Order.find({ user: req.user._id }).populate('products.product', 'name imageUrl');
        res.json(orders);
    } catch (error) {
        console.error(error);
        res.status(500).send('Erro no servidor');
    }
});

// [GET] /api/orders - Listar todos os pedidos (Admin)
app.get('/api/orders', protect, isAdmin, async (req, res) => {
    try {
        const orders = await Order.find({}).populate('user', 'id name');
        res.json(orders);
    } catch (error) {
        console.error(error);
        res.status(500).send('Erro no servidor');
    }
});

// [GET] /api/admin/stats - Obter estatísticas para o painel admin
app.get('/api/admin/stats', protect, isAdmin, async (req, res) => {
    try {
        const totalUsers = await User.countDocuments();
        const totalOrders = await Order.countDocuments();
        const totalSales = await Order.aggregate([
            { $match: { 'paymentDetails.paymentStatus': 'Completed' } },
            { $group: { _id: null, total: { $sum: '$totalAmount' } } }
        ]);

        const mostSoldProducts = await Order.aggregate([
            { $unwind: '$products' },
            { $group: { _id: '$products.product', totalQuantity: { $sum: '$products.quantity' } } },
            { $sort: { totalQuantity: -1 } },
            { $limit: 5 },
            { $lookup: { from: 'products', localField: '_id', foreignField: '_id', as: 'productDetails' } },
            { $unwind: '$productDetails' },
            { $project: { name: '$productDetails.name', totalQuantity: 1, _id: 0 } }
        ]);
        
        res.json({
            users: { total: totalUsers },
            orders: { total: totalOrders },
            sales: { total: totalSales.length > 0 ? totalSales[0].total : 0 },
            mostSoldProducts
        });
    } catch (error) {
        console.error(error);
        res.status(500).send('Erro no servidor');
    }
});

// -------------------- ROTAS DE USUÁRIOS (ADMIN) --------------------
// [GET] /api/users - Listar todos os usuários (Admin)
app.get('/api/users', protect, isAdmin, async (req, res) => {
    try {
        const users = await User.find({});
        res.json(users);
    } catch (error) {
        res.status(500).send('Erro no servidor');
    }
});

// [PUT] /api/users/:id/toggle-active - Ativar/desativar um usuário (Admin)
app.put('/api/users/:id/toggle-active', protect, isAdmin, async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) {
            return res.status(404).json({ message: 'Usuário não encontrado.' });
        }
        user.isActive = !user.isActive;
        await user.save();
        res.json({ message: `Usuário ${user.isActive ? 'ativado' : 'desativado'} com sucesso.` });
    } catch (error) {
        res.status(500).send('Erro no servidor');
    }
});

// =================================================================
// 6. INICIALIZAÇÃO DO SERVIDOR
// =================================================================
app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
});