import { Route, Routes } from 'react-router-dom';
import Layout from './components/layout/Layout.jsx';
import About from './pages/About.jsx';
import Account from './pages/account/Account.jsx';
import OrderDetail from './pages/account/OrderDetail.jsx';
import Orders from './pages/account/Orders.jsx';
import Receipt from './pages/account/Receipt.jsx';
import ReturnRequest from './pages/account/ReturnRequest.jsx';
import ReviewForm from './pages/account/ReviewForm.jsx';
import RequireLogin from './components/RequireLogin.jsx';
import ForgotPassword from './pages/auth/ForgotPassword.jsx';
import Login from './pages/auth/Login.jsx';
import Register from './pages/auth/Register.jsx';
import ResetPassword from './pages/auth/ResetPassword.jsx';
import Cart from './pages/Cart.jsx';
import Checkout from './pages/Checkout.jsx';
import Contact from './pages/Contact.jsx';
import Home from './pages/Home.jsx';
import NotFound from './pages/NotFound.jsx';
import OrderConfirmation from './pages/OrderConfirmation.jsx';
import Policy from './pages/Policy.jsx';
import ProductDetails from './pages/ProductDetails.jsx';
import Shop from './pages/Shop.jsx';
import TrackOrder from './pages/TrackOrder.jsx';
import Wishlist from './pages/Wishlist.jsx';

export default function App() {
  return (
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
        <Route path="contact" element={<Contact />} />
        <Route path="policies/:page" element={<Policy />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
