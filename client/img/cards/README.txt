ИНСТРУКЦИЯ ПО ДОБАВЛЕНИЮ КАРТИНОК И РУБАШЕК КАРТ:
=====================================================

Вы можете положить в эту папку свои изображения:

1. `card_back.png` (или .jpg) — изображение для рубашки скрытых карт.
2. `card_face.png` (или .jpg) — фоновый шаблон для лицевой стороны карт (пустая рамка, поверх которой выводится текст).
3. Картинки по категориям:
   - `cat_profession.png`
   - `cat_health.png`
   - `cat_biology.png`
   - `cat_hobby.png`
   - `cat_traits.png`
   - `cat_facts.png`
   - `cat_small_inventory.png`
   - `cat_large_inventory.png`
   - `cat_special.png`

В CSS файле (client/css/style.css) для классов `.card-back` и `.card-front` уже настроены стили и слои, которые сразу подхватят любые фоновые текстуры.
