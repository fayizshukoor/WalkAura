<aside class="w-64 border-r border-gray-900 hidden md:flex flex-col sticky top-0 h-screen bg-black flex-shrink-0">
            <div class="p-6 flex items-center gap-3 border-b border-gray-900">
                <div class="w-10 h-10 rounded-full bg-gray-700 flex-shrink-0"></div>
                <div class="overflow-hidden">
                    <p class="text-sm font-bold text-white truncate">Alex Hartman</p>
                    <p class="text-xs text-gray-500">Admin</p>
                </div>
            </div>

            <nav id="admin-sidebar-nav" class="flex-1 px-4 py-4 space-y-1 overflow-y-auto">
                <a href="/admin/dashboard" class="nav-item flex items-center gap-3 p-3 rounded-lg transition-all group text-gray-400 hover:text-white hover:bg-gray-900">
                    <span class="material-symbols-outlined">dashboard</span>
                    <span class="text-sm font-medium">Dashboard</span>
                </a>
                <a href="/admin/orders" class="nav-item flex items-center gap-3 p-3 rounded-lg transition-all group text-gray-400 hover:text-white hover:bg-gray-900">
                    <span class="material-symbols-outlined">description</span>
                    <span class="text-sm font-medium">Orders</span>
                </a>
                <a href="/admin/products" class="nav-item flex items-center gap-3 p-3 rounded-lg transition-all group text-gray-400 hover:text-white hover:bg-gray-900">
                    <span class="material-symbols-outlined">inventory_2</span>
                    <span class="text-sm font-medium">Products</span>
                </a>
                <a href="/admin/customers" class="nav-item flex items-center gap-3 p-3 rounded-lg transition-all group text-gray-400 hover:text-white hover:bg-gray-900">
                    <span class="material-symbols-outlined">group</span>
                    <span class="text-sm font-medium">Customers</span>
                </a>
                <a href="/admin/sales-report" class="nav-item flex items-center gap-3 p-3 rounded-lg transition-all group text-gray-400 hover:text-white hover:bg-gray-900">
                    <span class="material-symbols-outlined">monitoring</span>
                    <span class="text-sm font-medium">Sales Report</span>
                </a>
                <a href="/admin/coupons" class="nav-item flex items-center gap-3 p-3 rounded-lg transition-all group text-gray-400 hover:text-white hover:bg-gray-900">
                    <span class="material-symbols-outlined">confirmation_number</span>
                    <span class="text-sm font-medium">Coupon</span>
                </a>
                <a href="/admin/categories" class="nav-item flex items-center gap-3 p-3 rounded-lg transition-all group text-gray-400 hover:text-white hover:bg-gray-900">
                    <span class="material-symbols-outlined">folder</span>
                    <span class="text-sm font-medium">Category</span>
                </a>
                <a href="/admin/banners" class="nav-item flex items-center gap-3 p-3 rounded-lg transition-all group text-gray-400 hover:text-white hover:bg-gray-900">
                    <span class="material-symbols-outlined">grid_view</span>
                    <span class="text-sm font-medium">Banners</span>
                </a>
                <a href="/admin/referrals" class="nav-item flex items-center gap-3 p-3 rounded-lg transition-all group text-gray-400 hover:text-white hover:bg-gray-900">
                    <span class="material-symbols-outlined">share</span>
                    <span class="text-sm font-medium">Referrals</span>
                </a>
                <a href="/admin/settings" class="nav-item flex items-center gap-3 p-3 rounded-lg transition-all group text-gray-400 hover:text-white hover:bg-gray-900">
                    <span class="material-symbols-outlined">settings</span>
                    <span class="text-sm font-medium">Settings</span>
                </a>
            </nav>

            <div class="p-4 border-t border-gray-900">
    <a href="/admin/logout" class="flex items-center gap-3 p-3 text-gray-400 hover:text-red-500 hover:bg-red-500/5 rounded-lg transition-all group w-full">
        <span class="material-symbols-outlined group-hover:text-red-500 transition-colors">logout</span>
        <span class="text-sm font-medium group-hover:text-red-500 transition-colors">Logout</span>
    </a>
</div>
        </aside>