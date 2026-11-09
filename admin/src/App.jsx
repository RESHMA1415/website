import { Link, Route, Routes } from 'react-router-dom';
import { RequireAdmin } from './auth.jsx';
import AdminLayout from './components/AdminLayout.jsx';
import Account from './pages/Account.jsx';
import Categories from './pages/Categories.jsx';
import Customers from './pages/Customers.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Inventory from './pages/Inventory.jsx';
import Login from './pages/Login.jsx';
import Media from './pages/Media.jsx';
import Messages from './pages/Messages.jsx';
import OrderDetail from './pages/OrderDetail.jsx';
import Orders from './pages/Orders.jsx';
import PackingSlips from './pages/PackingSlips.jsx';
import Payments from './pages/Payments.jsx';
import ProductForm from './pages/ProductForm.jsx';
import Products from './pages/Products.jsx';
import Reports from './pages/Reports.jsx';
import Returns from './pages/Returns.jsx';
import Reviews from './pages/Reviews.jsx';
import Settings from './pages/Settings.jsx';
import SizeCharts from './pages/SizeCharts.jsx';

function NotFound() {
  return (
    <div className="text-center py-5">
      <h1 className="h3">Page not found</h1>
      <Link to="/" className="btn btn-orange mt-2">Back to Dashboard</Link>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="login" element={<Login />} />
      <Route
        element={
          <RequireAdmin>
            <AdminLayout />
          </RequireAdmin>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="products" element={<Products />} />
        <Route path="products/new" element={<ProductForm />} />
        <Route path="products/:id" element={<ProductForm />} />
        <Route path="categories" element={<Categories />} />
        <Route path="size-charts" element={<SizeCharts />} />
        <Route path="inventory" element={<Inventory />} />
        <Route path="media" element={<Media />} />
        <Route path="orders" element={<Orders />} />
        <Route path="orders/print" element={<PackingSlips />} />
        <Route path="orders/:orderNumber" element={<OrderDetail />} />
        <Route path="returns" element={<Returns />} />
        <Route path="payments" element={<Payments />} />
        <Route path="reports" element={<Reports />} />
        <Route path="customers" element={<Customers />} />
        <Route path="reviews" element={<Reviews />} />
        <Route path="messages" element={<Messages />} />
        <Route path="settings" element={<Settings />} />
        <Route path="account" element={<Account />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
