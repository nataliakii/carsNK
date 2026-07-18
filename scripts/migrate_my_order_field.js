/**
 * Миграция базы данных для добавления поля my_order к существующим заказам
 * 
 * Этот скрипт добавляет поле my_order = false ко всем заказам, 
 * которые не имеют этого поля (старые заказы)
 */

const { MongoClient } = require('mongodb');

// Конфигурация базы данных
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/natalicar';

async function migrateMyOrderField() {
  const client = new MongoClient(MONGODB_URI);
  
  try {
    // Подключение к базе данных
    await client.connect();
    console.log('✅ Подключено к MongoDB');
    
    const db = client.db();
    const ordersCollection = db.collection('orders');
    
    // Найдем все заказы без поля my_order
    const ordersWithoutMyOrderField = await ordersCollection.countDocuments({
      my_order: { $exists: false }
    });
    
    console.log(`📊 Найдено ${ordersWithoutMyOrderField} заказов без поля my_order`);
    
    if (ordersWithoutMyOrderField === 0) {
      console.log('✅ Все заказы уже имеют поле my_order. Миграция не требуется.');
      return;
    }
    
    // Обновляем все заказы без поля my_order, устанавливая значение false
    const result = await ordersCollection.updateMany(
      { my_order: { $exists: false } },
      { $set: { my_order: false } }
    );
    
    console.log(`✅ Обновлено ${result.modifiedCount} заказов`);
    console.log(`📈 Результат миграции:`);
    console.log(`   - Найдено заказов без поля: ${ordersWithoutMyOrderField}`);
    console.log(`   - Обновлено заказов: ${result.modifiedCount}`);
    
    // Проверяем результат
    const totalOrders = await ordersCollection.countDocuments({});
    const ordersWithMyOrderTrue = await ordersCollection.countDocuments({ my_order: true });
    const ordersWithMyOrderFalse = await ordersCollection.countDocuments({ my_order: false });
    
    console.log(`📊 Статистика после миграции:`);
    console.log(`   - Всего заказов: ${totalOrders}`);
    console.log(`   - Заказов с главной страницы (my_order = true): ${ordersWithMyOrderTrue}`);
    console.log(`   - Админских заказов (my_order = false): ${ordersWithMyOrderFalse}`);
    
  } catch (error) {
    console.error('❌ Ошибка при миграции:', error);
    throw error;
  } finally {
    // Закрываем соединение
    await client.close();
    console.log('✅ Соединение с MongoDB закрыто');
  }
}

// Запуск миграции
if (require.main === module) {
  migrateMyOrderField()
    .then(() => {
      console.log('🎉 Миграция завершена успешно!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Миграция завершилась с ошибкой:', error);
      process.exit(1);
    });
}

module.exports = { migrateMyOrderField };
