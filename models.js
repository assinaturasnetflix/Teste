// backend/models.js

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// =================================================================
// 1. ESQUEMA DO USUÁRIO (UserSchema)
// =================================================================
// Define a estrutura para os usuários do nosso sistema.
const UserSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'O nome é obrigatório.'],
  },
  email: {
    type: String,
    required: [true, 'O email é obrigatório.'],
    unique: true, // Garante que cada email seja único no banco de dados
    match: [/.+\@.+\..+/, 'Por favor, insira um email válido.'], // Validação simples de email
  },
  password: {
    type: String,
    required: [true, 'A senha é obrigatória.'],
    select: false, // Por padrão, não retorna a senha nas queries
  },
  role: {
    type: String,
    enum: ['client', 'admin'], // O usuário só pode ter uma dessas duas funções
    default: 'client', // Todo novo usuário é um 'client' por padrão
  },
  isActive: {
    type: Boolean,
    default: true, // O usuário está ativo por padrão
  },
}, {
  timestamps: true, // Adiciona os campos createdAt e updatedAt automaticamente
});

// Middleware (pre-save hook) para criptografar a senha ANTES de salvar no banco
UserSchema.pre('save', async function (next) {
  // Só criptografa a senha se ela foi modificada (ou é nova)
  if (!this.isModified('password')) {
    return next();
  }
  // Gera o "salt" e cria o hash da senha
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// =================================================================
// 2. ESQUEMA DO PRODUTO (ProductSchema)
// =================================================================
// Define a estrutura para os produtos da loja.
const ProductSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'O nome do produto é obrigatório.'],
  },
  description: {
    type: String,
    required: [true, 'A descrição do produto é obrigatória.'],
  },
  price: {
    type: Number,
    required: [true, 'O preço do produto é obrigatório.'],
  },
  category: {
    type: String,
    required: [true, 'A categoria do produto é obrigatória.'],
  },
  stock: [{ // Um array para lidar com diferentes tamanhos e quantidades
    size: { type: String, required: true }, // Ex: 'P', 'M', 'G'
    quantity: { type: Number, required: true, min: 0 },
  }],
  imageUrl: { // URL da imagem hospedada no Cloudinary
    type: String,
    required: [true, 'A imagem do produto é obrigatória.'],
  },
  cloudinary_id: { // ID público da imagem no Cloudinary (para poder deletá-la)
    type: String,
    required: true,
  }
}, {
  timestamps: true,
});

// =================================================================
// 3. ESQUEMA DO PEDIDO (OrderSchema)
// =================================================================
// Define a estrutura para os pedidos realizados pelos clientes.
const OrderSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User', // Cria uma referência ao modelo User
    required: true,
  },
  products: [{
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    quantity: { type: Number, required: true },
    size: { type: String, required: true },
    price: { type: Number, required: true }, // Preço no momento da compra, para histórico
  }],
  totalAmount: {
    type: Number,
    required: true,
  },
  status: {
    type: String,
    enum: ['Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled'],
    default: 'Pending',
  },
  shippingAddress: { // Endereço de entrega
    street: { type: String, required: true },
    city: { type: String, required: true },
    postalCode: { type: String, required: true },
  },
  paymentDetails: { // Detalhes do pagamento (simulado)
    method: { type: String, default: 'M-Pesa' },
    transactionId: { type: String },
    paymentStatus: { type: String, enum: ['Pending', 'Completed', 'Failed'], default: 'Pending' }
  }
}, {
  timestamps: true,
});


// Criando os modelos a partir dos esquemas
const User = mongoose.model('User', UserSchema);
const Product = mongoose.model('Product', ProductSchema);
const Order = mongoose.model('Order', OrderSchema);

// Exportando os modelos para serem usados em outras partes da aplicação
module.exports = { User, Product, Order };