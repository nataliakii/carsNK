/**
 * Миграция базы данных для переименования поля childSeats в ChildSeats
 * 
 * Этот скрипт переименовывает поле childSeats (с маленькой буквы) в ChildSeats (с большой буквы)
 * во всех заказах в базе данных MongoDB.
 * 
 * MongoDB чувствителен к регистру имен полей, поэтому это критически важно для совместимости
 * с обновленной схемой Mongoose.
 */

const { MongoClient } = require('mongodb');

// Конфигурация базы данных
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/natalicar';

async function migrateChildSeatsField() {
  const client = new MongoClient(MONGODB_URI);
  
  try {
    // Подключение к базе данных
    await client.connect();
    console.log('✅ Подключено к MongoDB');
    
    const db = client.db();
    const ordersCollection = db.collection('orders');
    
    // Найдем все заказы с полем childSeats (с маленькой буквы)
    const ordersWithChildSeats = await ordersCollection.countDocuments({
      childSeats: { $exists: true }
    });
    
    console.log(`📊 Найдено ${ordersWithChildSeats} заказов с полем childSeats (с маленькой буквы)`);
    
    if (ordersWithChildSeats === 0) {
      console.log('✅ Все заказы уже используют поле ChildSeats (с большой буквы). Миграция не требуется.');
      
      // Проверяем, есть ли заказы с ChildSeats (с большой буквы)
      const ordersWithChildSeatsCapital = await ordersCollection.countDocuments({
        ChildSeats: { $exists: true }
      });
      console.log(`📊 Заказов с полем ChildSeats (с большой буквы): ${ordersWithChildSeatsCapital}`);
      
      return;
    }
    
    // Найдем все заказы с childSeats для миграции
    const ordersToMigrate = await ordersCollection.find({
      childSeats: { $exists: true }
    }).toArray();
    
    console.log(`🔄 Начинаем миграцию ${ordersToMigrate.length} заказов...`);
    
    let migratedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    
    // Мигрируем каждый заказ
    for (const order of ordersToMigrate) {
      try {
        const childSeatsValue = order.childSeats;
        
        // Проверяем, есть ли уже поле ChildSeats (с большой буквы)
        if (order.ChildSeats !== undefined) {
          console.log(`⚠️  Заказ ${order._id} уже имеет поле ChildSeats. Пропускаем.`);
          skippedCount++;
          continue;
        }
        
        // Обновляем заказ: добавляем ChildSeats и удаляем childSeats
        const result = await ordersCollection.updateOne(
          { _id: order._id },
          {
            $set: { ChildSeats: childSeatsValue },
            $unset: { childSeats: "" }
          }
        );
        
        if (result.modifiedCount > 0) {
          migratedCount++;
          if (migratedCount % 100 === 0) {
            console.log(`   ✅ Мигрировано ${migratedCount} заказов...`);
          }
        }
      } catch (error) {
        console.error(`❌ Ошибка при миграции заказа ${order._id}:`, error.message);
        errorCount++;
      }
    }
    
    console.log(`\n📈 Результат миграции:`);
    console.log(`   - Найдено заказов с childSeats: ${ordersWithChildSeats}`);
    console.log(`   - Успешно мигрировано: ${migratedCount}`);
    console.log(`   - Пропущено (уже имеют ChildSeats): ${skippedCount}`);
    console.log(`   - Ошибок: ${errorCount}`);
    
    // Проверяем результат
    const totalOrders = await ordersCollection.countDocuments({});
    const ordersWithChildSeatsAfter = await ordersCollection.countDocuments({
      childSeats: { $exists: true }
    });
    const ordersWithChildSeatsCapitalAfter = await ordersCollection.countDocuments({
      ChildSeats: { $exists: true }
    });
    
    console.log(`\n📊 Статистика после миграции:`);
    console.log(`   - Всего заказов: ${totalOrders}`);
    console.log(`   - Заказов с childSeats (старое): ${ordersWithChildSeatsAfter}`);
    console.log(`   - Заказов с ChildSeats (новое): ${ordersWithChildSeatsCapitalAfter}`);
    
    if (ordersWithChildSeatsAfter > 0) {
      console.log(`\n⚠️  ВНИМАНИЕ: Осталось ${ordersWithChildSeatsAfter} заказов со старым полем childSeats!`);
      console.log(`   Возможно, они были созданы во время миграции. Запустите миграцию еще раз.`);
    } else {
      console.log(`\n✅ Миграция завершена успешно! Все заказы используют ChildSeats (с большой буквы).`);
    }
    
  } catch (error) {
    console.error('❌ Ошибка при миграции:', error);
    throw error;
  } finally {
    // Закрываем соединение
    await client.close();
    console.log('\n✅ Соединение с MongoDB закрыто');
  }
}

// Запуск миграции
if (require.main === module) {
  migrateChildSeatsField()
    .then(() => {
      console.log('\n🎉 Миграция завершена успешно!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Миграция завершилась с ошибкой:', error);
      process.exit(1);
    });
}

module.exports = { migrateChildSeatsField };

