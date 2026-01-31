import { HTTP_STATUS } from "../../constants/httpStatus.js";
import { calculateFinalPrice } from "../../helpers/price.helper.js";
import Address from "../../models/Address.model.js";
import Cart from "../../models/Cart.model.js";
import Inventory from "../../models/Inventory.model.js";
import Order from "../../models/Order.model.js";
import asyncHandler from "../../utils/asyncHandler.js";


const TAX_PERCENTAGE = 18;

export const getCheckoutPage = asyncHandler(async (req,res)=>{

    const userId = req.user.userId;

    // Get Cart with full details

    const cart = await Cart.findOne({user: userId})
    .populate({
        path:"items.product",
        select: "name price offerPercent offerExpiry category isListed",
        populate:{
            path: "category",
            select: "name offerPercent offerExpiry isListed isDeleted"
        }
    })
    .populate({
        path: "items.variant",
        select: "color images isActive"
    })
    .populate({
        path: "items.inventory",
        select: "size stock isActive"
    });

    // Check cart is empty

    if(!cart || cart.items.length === 0){
        // If it's an AJAX/Fetch request (from a button)
        if (req.xhr || req.headers.accept.indexOf('json') > -1) {
            return res.status(HTTP_STATUS.NOT_FOUND).json({ message: "Cart is Empty" });
        }

        req.flash("error","Cart is Empty")
        return res.status(404).redirect("/cart");
    }

    // Validate all cart items
    const validatedItems = [];
    const invalidItems = [];
    let hasStockIssues = false;

    for(const item of cart.items){

        // Check product validity
        if(!item.product || !item.product.isListed || !item.product.category || !item.product.category.isListed || item.product.category.isDeleted){
            invalidItems.push({
                name: item.product?.name || "Unknown Product",
                reason: "Product no longer available"
            });

            continue;
        }

        // Check variant validity
        if(!item.variant || !item.variant.isActive){
            console.log(item.variant);
            invalidItems.push({
                name: item.product.name ,
                reason: `${item.variant?.color ?? "Selected"} color is no longer available`
            });

            continue;
        }

        // Check inventory validity
        if(!item.inventory || !item.inventory.isActive){
            invalidItems.push({
                name: item.product.name ,
                reason: `Size UK ${item.inventory?.size ?? "Selected"} is no longer available`
            });
            continue;
        }

        if(item.inventory.stock === 0){
            invalidItems.push({
                name: item.product.name,
                reason: "Out of stock",
              });
              hasStockIssues = true;
              continue;
        }

        if (item.quantity > item.inventory.stock) {
            invalidItems.push({
              name: item.product.name,
              reason: `Only ${item.inventory.stock} items available`,
            });
            hasStockIssues = true;
            continue;
          }

          // Calculate current price
          const currentPrice = calculateFinalPrice({
            price: item.product.price,
            productOffer: item.product.offerPercent,
            productOfferExpiry: item.product.offerExpiry,
            categoryOffer: item.product.category.offerPercent,
            categoryOfferExpiry: item.product.category.offerExpiry,
          });
          
          validatedItems.push({
            product: item.product._id,
            productName: item.product.name,
            variant: item.variant._id,
            color: item.variant.color,
            image: item.variant.images[0]?.url || "",
            inventory: item.inventory._id,
            size: item.inventory.size,
            quantity: item.quantity,
            price: currentPrice,
            itemTotal: currentPrice * item.quantity,
          });    
    }


    // If there are invalid items, handle appropriately
    if (invalidItems.length > 0) {
      const errorMessage = hasStockIssues
        ? "Some items are out of stock or have insufficient stock"
        : "Some items in your cart are no longer available";

      // Check if it's a page request or API request
      if (req.xhr || req.headers.accept?.indexOf('json') > -1) {
        return res.status(400).json({
          success: false,
          message: errorMessage,
          invalidItems,
        });
      }

      // For browser requests, redirect to cart with flash message
      req.flash('error', errorMessage);
      return res.redirect('/cart');
    }

    // Get user addresses
    const addresses = await Address.find({
      userId: userId,
      isDeleted: false
    }).sort({ createdAt: -1 });


    const subtotal = validatedItems.reduce((sum, item) => sum + item.itemTotal, 0);
    const tax = Math.round((subtotal * TAX_PERCENTAGE) / 100);; 
    const shippingCharge = 50; 
    const discount = 0; 
    const totalAmount = subtotal + tax + shippingCharge - discount;

    return res.render("user/checkout",{
        checkout: {
          items: validatedItems,
          addresses,
          pricing: {
            subtotal,
            tax,
            shippingCharge,
            discount,
            totalAmount,
          },
        },
      });
})




export const placeOrder = asyncHandler(async (req, res) => {
   

    const { addressId, paymentMethod = "COD" } = req.body;
      const userId = req.user.userId;
    
  
      if (paymentMethod !== "COD") {
        return res.status(400).json({
          success: false,
          message: "Only Cash on Delivery is supported currently",
        });
      }
  
      // Validate address
      const address = await Address.findOne({
        _id: addressId,
        userId: userId,
        isDeleted: false,
      });

      console.log(address);
  
      if (!address) {
        return res.status(404).json({
          success: false,
          message: "Invalid delivery address",
        });
      }
  
      // Get cart with populate 
      const cart = await Cart.findOne({ user: userId })
        .populate({
          path: "items.product",
          select: "name price offerPercent offerExpiry isListed category",
          populate: {
            path: "category",
            select: "name offerPercent offerExpiry isListed isDeleted",
          },
        })
        .populate({
          path: "items.variant",
          select: "color images isActive",
        })
        .populate({
          path: "items.inventory",
          select: "size stock sku isActive",
        });
  
      if (!cart || cart.items.length === 0) {
        return res.status(400).json({
          success: false,
          message: "Your cart is empty",
        });
      }
  
      const orderItems = [];
      const stockUpdates = [];
  
      for (const item of cart.items) {
        // Validate product
        if (!item.product || !item.product.isListed) {
          return res.status(400).json({
            success: false,
            message: `Product "${item.product?.name || "Unknown"}" is no longer available`,
          });
        }
  
        // Validate category
        if (
          !item.product.category ||
          !item.product.category.isListed ||
          item.product.category.isDeleted
        ) {
          return res.status(400).json({
            success: false,
            message: `Product "${item.product.name}" category is no longer available`,
          });
        }
  
        // Validate variant
        if (!item.variant || !item.variant.isActive) {
          return res.status(400).json({
            success: false,
            message: `Selected color for "${item.product.name}" is no longer available`,
          });
        }
  
        // Validate inventory and stock
        if (!item.inventory || !item.inventory.isActive) {
          return res.status(400).json({
            success: false,
            message: `Selected size for "${item.product.name}" is no longer available`,
          });
        }
  
        if (item.inventory.stock < item.quantity) {
          return res.status(400).json({
            success: false,
            message: `Insufficient stock for "${item.product.name}". Only ${item.inventory.stock} available`,
          });
        }
  
        // Calculate final price
        const finalPrice = calculateFinalPrice({
          price: item.product.price,
          productOffer: item.product.offerPercent,
          productOfferExpiry: item.product.offerExpiry,
          categoryOffer: item.product.category.offerPercent,
          categoryOfferExpiry: item.product.category.offerExpiry,
        });
  
        orderItems.push({
          product: item.product._id,
          productName: item.product.name,
          variant: item.variant._id,
          color: item.variant.color,
          image: item.variant.images[0]?.url || "",
          inventory: item.inventory._id,
          size: item.inventory.size,
          sku: item.inventory.sku,
          quantity: item.quantity,
          price: finalPrice,
          itemTotal: finalPrice * item.quantity,
          status: "Pending",
        });
  
        stockUpdates.push({
          inventoryId: item.inventory._id,
          quantity: item.quantity,
        });
      }
  
      // Calculate totals
      const subtotal = orderItems.reduce((sum, item) => sum + item.itemTotal, 0);
      const tax = Math.round((subtotal * TAX_PERCENTAGE) / 100);
      const shippingCharge = 0;
      const discount = 0;
      const totalAmount = subtotal + tax + shippingCharge - discount;
  
      // Generate unique order ID
      const orderCount = await Order.countDocuments();
      const orderId = `ORD${Date.now()}${String(orderCount + 1).padStart(4, "0")}`;
  
      // Create order
      const order = new Order({
        orderId,
        user: userId,
        items: orderItems,
        shippingAddress: {
          fullName: address.fullName,
          phone: address.phone,
          streetAddress: address.streetAddress,
          city: address.city,
          state: address.state,
          pincode: address.pincode,
        },
        paymentMethod,
        paymentStatus: "Pending",
        orderStatus: "Pending",
        pricing: {
          subtotal,
          tax,
          taxPercentage: TAX_PERCENTAGE,
          shippingCharge,
          discount,
          totalAmount,
        },
      });
  
      await order.save();
  
      // Update stock
      for (const update of stockUpdates) {
        await Inventory.findByIdAndUpdate(update.inventoryId, {
          $inc: { stock: -update.quantity },
        });
      }
  
      // Clear cart
      cart.items = [];
      cart.totalItems = 0;
      cart.totalAmount = 0;
      await cart.save();
  
      res.status(201).json({
        success: true,
        message: "Order placed successfully",
        order: {
          orderId: order.orderId,
          _id: order._id,
          totalAmount: order.pricing.totalAmount,
          orderDate: order.createdAt,
        },
      });
  });


  export const getOrderSuccess = async (req, res) => {

    const { orderId } = req.params;
      const userId = req.user.userId;
  
      const order = await Order.findOne({
        orderId,
        user: userId,
      }).select("orderId pricing createdAt orderStatus items");
  
      if (!order) {
        return res.status(404).json({
          success: false,
          message: "Order not found",
        });
      }
  
      // Structure the response with everything needed for the success page
    const orderData = {
      // Basic order info
      orderId: order.orderId,
      orderStatus: order.orderStatus,
      orderDate: order.createdAt,
      paymentMethod: order.paymentMethod,
      paymentStatus: order.paymentStatus,

      // All items with full details (already snapshotted, no populate needed)
      items: order.items.map((item) => ({
        _id: item._id,
        productName: item.productName,
        image: item.image,
        color: item.color,
        size: item.size,
        sku: item.sku,
        quantity: item.quantity,
        price: item.price,
        itemTotal: item.itemTotal,
        status: item.status,
      })),

      // Shipping address
      shippingAddress: {
        fullName: order.shippingAddress.fullName,
        phone: order.shippingAddress.phone,
        streetAddress: order.shippingAddress.streetAddress,
        city: order.shippingAddress.city,
        state: order.shippingAddress.state,
        pincode: order.shippingAddress.pincode,
        country: order.shippingAddress.country,
      },

      // Pricing breakdown
      pricing: {
        subtotal: order.pricing.subtotal,
        tax: order.pricing.tax,
        taxPercentage: order.pricing.taxPercentage,
        shippingCharge: order.pricing.shippingCharge,
        discount: order.pricing.discount,
        totalAmount: order.pricing.totalAmount,
      },
    };


      res.render("user/order-confirmation",{
        success: true,
        order:orderData
      });
   
  };


export const getOrderDetails = async (req,res)=>{
    res.render("user/order-confirmation");
}