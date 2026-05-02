import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Search, Package, Cookie, PencilLine, Coffee, X, Truck, Loader2, Rocket, MapPin } from 'lucide-react';
import { BottomSheet } from '../components/ui';
import { useAppActions, useAppState } from '../state/AppStateProvider';
import type { Product } from '../state/appState';

const CATEGORIES = [
  { id: 'snacks', icon: Cookie, label: '精選零食' },
  { id: 'stationery', icon: PencilLine, label: '文具用品' },
  { id: 'drinks', icon: Coffee, label: '飲品' },
];

export function DeliveryView({ showToast, navigateTo }: { showToast: (msg: string) => void, navigateTo: (id: string, props?: any) => void }) {
  const state = useAppState();
  const actions = useAppActions();
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [modal, setModal] = useState<string | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [qty, setQty] = useState(1);
  const [isOrdering, setIsOrdering] = useState(false);
  const [dest, setDest] = useState('101 教室');

  const LOCATIONS = ['101 教室', '507 教室', '教職員辦公室', '圖書館', '操場 A 區'];
  const activeOrder = state.orders.find((order) => order.status === 'in_transit') ?? null;
  const orderStatus = activeOrder ? `送達 ${activeOrder.destination}: ${activeOrder.productName} x${activeOrder.quantity}` : null;

  const filteredProducts = useMemo(() => {
    let filtered = state.products;
    if (activeCategory !== 'all') {
      filtered = filtered.filter(p => p.category === activeCategory);
    }
    if (searchQuery.trim() !== '') {
      filtered = filtered.filter(p => p.name.includes(searchQuery.trim()) || p.desc.includes(searchQuery.trim()));
    }
    return filtered;
  }, [activeCategory, searchQuery, state.products]);

  const openProduct = (p: Product) => {
    setSelectedProduct(p);
    setQty(1);
    setModal('product');
  };

  const handleOrder = () => {
    if (!selectedProduct) return;
    setIsOrdering(true);
    setTimeout(() => {
      actions.createDeliveryOrder({ productId: selectedProduct.id, quantity: qty, destination: dest });
      showToast(`預約成功！機器人即將前往 ${dest}`);
      setIsOrdering(false);
      setModal(null);
      // Auto-complete the order after 35 seconds for demo purposes
      setTimeout(() => {
        actions.autoCompleteInTransit();
        showToast('✅ 配送完成！機器人已送達目的地');
      }, 35000);
      setTimeout(() => navigateTo('delivery-tracking'), 600);
    }, 1200);
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 24 } }
  };

  return (
    <div className="space-y-8 pb-6">
      {/* Search */}
      <section className="relative px-1">
        <div className="group relative flex items-center bg-surface-container-low rounded-[2rem] px-6 py-5 transition-all focus-within:bg-surface-container-lowest focus-within:ring-4 focus-within:ring-primary/5 shadow-inner border border-outline-variant/10">
          <Search className="text-on-surface-variant mr-4 shrink-0 transition-colors group-focus-within:text-primary" size={22} />
          <input
            type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value.slice(0, 50))}
            maxLength={50}
            className="bg-transparent border-none focus:outline-none focus:ring-0 w-full text-base font-bold placeholder:text-on-surface-variant/40"
            placeholder="搜尋課程餐盒、文具或實驗室耗材..."
          />
          {searchQuery && (
            <motion.button initial={{ scale: 0 }} animate={{ scale: 1 }} onClick={() => setSearchQuery('')} className="ml-2 bg-surface-container-high rounded-full p-2 hover:bg-surface-container-highest transition-colors flex items-center justify-center shrink-0">
              <X size={16} className="text-on-surface-variant" />
            </motion.button>
          )}
        </div>
      </section>

      {/* Delivery Tracking Herocard */}
      <section className="space-y-4">
        <h2 className="text-xl font-headline font-bold tracking-tight px-2 flex items-center gap-2">
           即時配送狀態
           <span className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse"></span>
        </h2>
        <button onClick={() => navigateTo('delivery-tracking')} className="w-full text-left bg-surface-container-low border border-outline-variant/30 rounded-[2.5rem] p-1.5 cursor-pointer group active:scale-[0.985] transition-all shadow-[0_4px_25px_rgba(0,0,0,0.02)] flex flex-col">
          <div className="bg-surface-container-lowest rounded-[2.2rem] p-7 space-y-7 group-hover:shadow-md transition-shadow relative overflow-hidden">
            <div className="flex justify-between items-start relative z-10">
              <div className="space-y-1.5">
                <span className="text-[10px] font-extrabold text-primary flex items-center gap-2">
                  {orderStatus ? '運送中' : '待命模式'}
                </span>
                <h3 className="text-3xl font-headline font-bold tracking-tight">機器人 Delta-04</h3>
                <div className="flex items-center gap-2 mt-2">
                  <p className="text-[11px] text-on-surface-variant font-bold bg-surface-container-low px-3 py-1.5 rounded-xl border border-outline-variant/10 shadow-inner flex items-center gap-2">
                    <MapPin size={12} className="text-primary" /> {activeOrder ? `前往 ${activeOrder.destination}` : '等待任務指派...'}
                  </p>
                </div>
              </div>
              <div className="w-[72px] h-[72px] bg-primary text-white rounded-[1.75rem] flex items-center justify-center shadow-[0_8px_25px_rgba(var(--color-primary),0.3)] shrink-0 group-hover:-translate-y-1 transition-transform rotate-3">
                <Package size={34} />
              </div>
            </div>

            {/* Minimal Timeline preview inside Hero */}
            <div className="relative pl-6 space-y-8 mt-2 z-10">
              <div className="absolute left-[9px] top-2 bottom-2 w-[2px] bg-outline-variant/30"></div>
              <div className="relative flex items-center gap-5">
                <div className={`z-10 w-5 h-5 rounded-full border-4 border-surface-container-lowest ${orderStatus ? 'bg-primary shadow-[0_0_15px_rgba(var(--color-primary),0.4)]' : 'bg-surface-container-highest animate-pulse'}`}></div>
                <div className={`flex-1 px-5 py-3 rounded-2xl transition-all border ${orderStatus ? 'bg-surface-container-low border-outline-variant/30 text-on-surface shadow-sm' : 'opacity-40 border-transparent'}`}>
                  <p className="text-base font-bold truncate leading-none mb-1">{orderStatus ? '已離開配送中心' : '配送系統就緒'}</p>
                  {orderStatus && <p className="text-xs text-primary font-extrabold mt-1">預計 4 分鐘抵達</p>}
                </div>
              </div>
            </div>

            <div className="absolute -right-20 -bottom-20 w-64 h-64 opacity-5 blur-[70px] rounded-full bg-primary pointer-events-none group-hover:opacity-10 transition-opacity"></div>
          </div>
        </button>
      </section>

      {/* Categories */}
      <section className="space-y-5 px-1">
        <div className="flex justify-between items-end px-1">
          <h2 className="text-xl font-headline font-bold tracking-tight">分類</h2>
          <button onClick={() => { setActiveCategory('all'); setSearchQuery(''); }} className="text-xs text-primary font-bold hover:bg-primary/5 px-4 py-2 rounded-xl transition-all border border-primary/10 active:scale-95">顯示全部</button>
        </div>
        <div className="flex gap-3 overflow-x-auto pb-4 scrollbar-hide">
          {CATEGORIES.map(cat => {
            const isActive = activeCategory === cat.id;
            const Icon = cat.icon;
            return (
              <motion.button
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.95 }}
                key={cat.id}
                onClick={() => setActiveCategory(isActive ? 'all' : cat.id)}
                className={`flex-shrink-0 font-bold px-6 py-4 rounded-[1.25rem] flex items-center gap-3 transition-all border shadow-sm ${isActive ? 'bg-primary text-white border-primary shadow-xl shadow-primary/20' : 'bg-surface-container-lowest border-outline-variant/30 text-on-surface-variant hover:bg-surface-container-low'}`}
              >
                <Icon size={20} className={isActive ? 'text-white' : 'text-primary'} />
                <span className="text-sm tracking-tight">{cat.label}</span>
              </motion.button>
            );
          })}
        </div>
      </section>

      {/* Products List */}
      <section className="space-y-6 min-h-[300px] px-1">
        <div className="flex items-center gap-3 px-1 mb-2">
           <div className="w-1.5 h-6 bg-primary rounded-full"></div>
           <h2 className="text-2xl font-headline font-bold tracking-tight">
             {searchQuery ? '搜尋結果' : (activeCategory !== 'all' ? CATEGORIES.find(c => c.id === activeCategory)?.label : '熱門推薦商品')}
           </h2>
        </div>

        {filteredProducts.length === 0 ? (
          <div className="py-20 text-center text-on-surface-variant bg-surface-container-lowest rounded-[2.5rem] border-2 border-dashed border-outline-variant/30 px-10">
            <div className="w-20 h-20 bg-surface-container rounded-full flex items-center justify-center mx-auto mb-6">
               <Package size={40} className="opacity-20" />
            </div>
            <p className="font-bold text-xl tracking-tight text-on-surface">
              {searchQuery ? '無相符搜尋結果' : activeCategory !== 'all' ? '此分類目前無商品' : '找不到商品'}
            </p>
            <p className="text-sm mt-2 opacity-60">
              {searchQuery ? `找不到「${searchQuery}」，請嘗試其他關鍵字` : '請切換分類或清除篩選'}
            </p>
          </div>
        ) : (
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="show"
            key={activeCategory + searchQuery}
            className="grid grid-cols-1 gap-6"
          >
            {filteredProducts.map(product => (
              <motion.div
                variants={itemVariants}
                key={product.id}
                onClick={() => openProduct(product)}
                className={`flex gap-6 items-center group cursor-pointer bg-surface-container-lowest p-5 rounded-[2.5rem] border transition-all active:scale-[0.985] ${product.stock === 0 ? 'opacity-60 grayscale-[50%] pointer-events-none border-outline-variant/10' : 'border-outline-variant/30 shadow-[0_4px_20px_rgba(0,0,0,0.02)] hover:shadow-xl hover:border-primary/20'}`}
              >
                <div className="w-[124px] h-[124px] rounded-[2rem] overflow-hidden bg-surface-container-low shrink-0 relative shadow-inner">
                  <div className="absolute inset-0 bg-black/5 group-hover:bg-transparent z-10 transition-colors"></div>
                  <img src={product.img} alt={product.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-1000 ease-out" />
                  {product.stock === 0 && (
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] z-20 flex items-center justify-center">
                      <span className="text-white text-xs font-bold px-3 py-1.5 bg-black/50 rounded-lg border border-white/20">已售罄</span>
                    </div>
                  )}
                  <div className="absolute top-2 left-2 z-20">
                     <div className="bg-white/90 backdrop-blur shadow-sm px-2 py-0.5 rounded-lg text-[10px] font-bold text-primary">推薦</div>
                  </div>
                </div>
                <div className="flex-1 space-y-3 py-1 pr-1 min-w-0">
                  <div className="flex justify-between items-start gap-4">
                    <h3 className="font-bold text-xl leading-tight text-on-surface tracking-tight truncate">{product.name}</h3>
                  </div>
                  <p className="text-xs text-on-surface-variant font-medium leading-relaxed line-clamp-2 opacity-70">{product.desc}</p>

                  <div className="flex items-center justify-between pt-1">
                    <div className="flex items-center gap-3">
                       <span className="font-bold text-2xl text-primary tracking-tight">NT${product.price}</span>
                       <div className="h-4 w-[1px] bg-outline-variant/30"></div>
                       <span className={`text-xs font-bold ${product.stock > 10 ? 'text-[#87d46c]' : 'text-error'}`}>
                         庫存: {product.stock}
                       </span>
                    </div>
                    <button className="bg-surface-container-high group-hover:bg-primary group-hover:text-white text-on-surface w-11 h-11 rounded-2xl transition-all flex items-center justify-center shadow-sm active:scale-90 overflow-hidden relative">
                      <span className="text-xl font-bold relative z-10">+</span>
                      <motion.div initial={{ x: '-100%' }} whileHover={{ x: '100%' }} transition={{ duration: 0.5 }} className="absolute inset-0 bg-white/20 skew-x-12"></motion.div>
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>
        )}
      </section>

      {/* Product Detail Modal */}
      <BottomSheet isOpen={modal === 'product'} onClose={() => setModal(null)} title="商品詳細細節">
        {selectedProduct && (
          <div className="p-6 space-y-10 pb-10">
            <div className="w-full aspect-square rounded-[3rem] overflow-hidden bg-surface-container mb-6 shadow-2xl relative border-4 border-surface-container-highest">
               <img src={selectedProduct.img} className="w-full h-full object-cover transition-transform duration-1000" />
               <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent"></div>
               <div className="absolute bottom-8 left-8">
                  <span className="bg-primary px-4 py-1.5 rounded-xl text-xs font-extrabold text-white shadow-lg shadow-primary/30">品質認證</span>
               </div>
            </div>

            <div className="space-y-4 px-1">
              <div className="flex items-center gap-3">
                 <span className="bg-primary/10 text-primary px-3 py-1 rounded-lg text-xs font-extrabold leading-none border border-primary/20">
                   {CATEGORIES.find(c => c.id === selectedProduct.category)?.label || '推薦'}
                 </span>
                 <div className="h-1 w-1 bg-outline-variant rounded-full"></div>
                 <span className="text-xs text-on-surface-variant/60 font-bold">庫存 {selectedProduct.stock}</span>
              </div>
              <h2 className="text-4xl font-headline font-bold text-on-surface tracking-tight leading-none">{selectedProduct.name}</h2>
              <p className="text-on-surface-variant font-medium mt-6 leading-relaxed text-base bg-surface-container-low/50 p-7 rounded-[2rem] border border-outline-variant/10 shadow-inner">
                {selectedProduct.desc}
              </p>
            </div>

            <div className="flex items-center justify-between border-y border-outline-variant/20 py-10 my-10 px-2">
               <div className="flex flex-col">
                 <span className="text-xs font-bold text-on-surface-variant/60 mb-2">訂單總計</span>
                 <motion.span
                   key={qty}
                   initial={{ scale: 0.9, opacity: 0 }}
                   animate={{ scale: 1, opacity: 1 }}
                   className="font-bold text-5xl text-primary tracking-tight"
                 >
                   <span className="text-2xl mr-1.5 opacity-60">NT$</span>{selectedProduct.price * qty}
                 </motion.span>
               </div>

               <div className="flex items-center gap-5 bg-surface-container rounded-[2rem] p-2.5 shadow-inner border border-outline-variant/10">
                  <motion.button whileTap={{ scale: 0.9 }} onClick={() => setQty(Math.max(1, qty - 1))} disabled={isOrdering} className="w-14 h-14 rounded-2xl bg-surface-container-lowest text-on-surface shadow-sm flex items-center justify-center border border-outline-variant/20 hover:bg-white transition-colors active:shadow-inner disabled:opacity-30">
                    <span className="text-3xl font-bold leading-none">-</span>
                  </motion.button>
                  <span className="font-headline font-bold text-3xl w-10 text-center text-on-surface">{qty}</span>
                  <motion.button whileTap={{ scale: 0.9 }} onClick={() => setQty(Math.min(selectedProduct.stock, qty + 1))} className="w-14 h-14 rounded-2xl bg-primary text-white shadow-xl shadow-primary/20 flex items-center justify-center disabled:opacity-30 hover:bg-primary/95 transition-all" disabled={qty >= selectedProduct.stock || isOrdering}>
                    <span className="text-3xl font-bold leading-none">+</span>
                  </motion.button>
               </div>
            </div>

             <div className="mb-10 px-2">
                <label className="block text-xs font-extrabold text-on-surface-variant/60 mb-4">選擇目的地</label>
                <div className="relative group">
                  <select value={dest} onChange={(e) => setDest(e.target.value)} className="w-full bg-surface-container-lowest border border-outline-variant/30 rounded-3xl px-8 py-5 text-lg font-bold focus:outline-none focus:ring-4 focus:ring-primary/5 appearance-none shadow-sm cursor-pointer transition-all hover:border-primary/40 focus:border-primary">
                    {LOCATIONS.map(loc => <option key={loc} value={loc}>{loc}</option>)}
                  </select>
                  <div className="absolute right-8 top-1/2 -translate-y-1/2 pointer-events-none text-primary bg-primary/10 w-10 h-10 rounded-xl flex items-center justify-center border border-primary/20 group-focus-within:bg-primary group-focus-within:text-white transition-all"><Rocket size={20} className="-rotate-12" /></div>
                </div>
             </div>

            <button
              onClick={handleOrder}
              disabled={isOrdering}
              className="w-full py-6 bg-primary hover:bg-primary/95 text-white font-bold text-xl tracking-tight rounded-[2rem] shadow-[0_12px_40px_rgba(var(--color-primary),0.3)] active:scale-[0.985] transition-all flex items-center justify-center gap-4 disabled:opacity-80 relative overflow-hidden group/btn"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover/btn:translate-x-full transition-transform duration-1000"></div>
              {isOrdering ? (
                <div className="flex items-center gap-3">
                  <Loader2 size={24} className="animate-spin" />
                  <span className="text-sm">正在建立訂單...</span>
                </div>
              ) : (
                <>
                  <Truck size={28} className="transition-transform group-hover/btn:-translate-y-1 group-hover/btn:rotate-6" />
                  <span className="tracking-tight">確認訂單並分派機器人</span>
                </>
              )}
            </button>
          </div>
        )}
      </BottomSheet>
    </div>
  );
}
