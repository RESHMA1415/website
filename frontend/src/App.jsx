import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router-dom';
import Layout from './components/layout/Layout.jsx';
import RequireLogin from './components/RequireLogin.jsx';
import Cart from './pages/Cart.jsx';
import Home from './pages/Home.jsx';
import NotFound from './pages/NotFound.jsx';
import ProductDetails from './pages/ProductDetails.jsx';
import Shop from './pages/Shop.jsx';

// Pages most shoppers never open download only when visited (faster first load on mobile)
const About = lazy(() => import('./pages/About.jsx'));
const Account = lazy(() => import('./pages/account/Account.jsx'));
const OrderDetail = lazy(() => import('./pages/account/OrderDetail.jsx'));
const Orders = lazy(() => import('./pages/account/Orders.jsx'));
const Receipt = lazy(() => import('./pages/account/Receipt.jsx'));
const ReturnRequest = lazy(() => import('./pages/account/ReturnRequest.jsx'));
const ReviewForm = lazy(() => import('./pages/account/ReviewForm.jsx'));
const ForgotPassword = lazy(() => import('./pages/auth/ForgotPassword.jsx'));
const Login = lazy(() => import('./pages/auth/Login.jsx'));
const Register = lazy(() => import('./pages/auth/Register.jsx'));
const ResetPassword = lazy(() => import('./pages/auth/ResetPassword.jsx'));
const Checkout = lazy(() => import('./pages/Checkout.jsx'));
const Contact = lazy(() => import('./pages/Contact.jsx'));
const OrderConfirmation = lazy(() => import('./pages/OrderConfirmation.jsx'));
const Policy = lazy(() => import('./pages/Policy.jsx'));
const TrackOrder = lazy(() => import('./pages/TrackOrder.jsx'));
const Unsubscribe = lazy(() => import('./pages/Unsubscribe.jsx'));
const Wishlist = lazy(() => import('./pages/Wishlist.jsx'));

export default function App() {
  return (
    <Suspense fallback={<div className="container py-5 text-center text-muted" role="status">Loading…</div>}>
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="about" element={<About />} />
        <Route path="shop" element={<Shop />} />
        <Route path="men" element={<Shop categorySlug="men" />} />
        <Route path="women" element={<Shop categorySlug="women" />} />
        <Route path="category/:slug" element={<Shop />} />
        <Route path="new-arrivals" element={<Shop newArrivals />} />
        <Route path="search" element={<Shop search />} />
        <Route path="product/:slug" element={<ProductDetails />} />
        <Route path="wishlist" element={<RequireLogin><Wishlist /></RequireLogin>} />
        <Route path="cart" element={<Cart />} />
        <Route path="checkout" element={<RequireLogin><Checkout /></RequireLogin>} />
        <Route path="order-confirmation/:orderNumber" element={<RequireLogin><OrderConfirmation /></RequireLogin>} />
        <Route path="login" element={<Login />} />
        <Route path="register" element={<Register />} />
        <Route path="forgot-password" element={<ForgotPassword />} />
        <Route path="reset-password" element={<ResetPassword />} />
        <Route path="account" element={<RequireLogin><Account /></RequireLogin>} />
        <Route path="account/:tab" element={<RequireLogin><Account /></RequireLogin>} />
        <Route path="account/orders" element={<RequireLogin><Orders /></RequireLogin>} />
        <Route path="account/orders/:orderNumber" element={<RequireLogin><OrderDetail /></RequireLogin>} />
        <Route path="account/orders/:orderNumber/return" element={<RequireLogin><ReturnRequest /></RequireLogin>} />
        <Route path="account/orders/:orderNumber/review/:productId" element={<RequireLogin><ReviewForm /></RequireLogin>} />
        <Route path="account/orders/:orderNumber/receipt" element={<RequireLogin><Receipt /></RequireLogin>} />
        <Route path="track-order" element={<TrackOrder />} />
        <Route path="newsletter/unsubscribe" element={<Unsubscribe />} />
        <Route path="contact" element={<Contact />} />
        <Route path="policies/:page" element={<Policy />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
    </Suspense>
  );
}
