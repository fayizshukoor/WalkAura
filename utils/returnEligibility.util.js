const RETURN_WINDOW_DAYS = 7;

export const isItemEligibleForReturn = (item) => {
  if (!item){
    return { eligible: false, message: "Item not found" };
  } 

  if(item.returninfo?.rejectedAt){
    return {eligible: false, message: "Return request was rejected for this item"};
  }

  if (item.status !== "DELIVERED") {
    return { eligible: false, message: "Item is not delivered yet" };
  }

  if (
    item.status === "RETURN_REQUESTED" ||
    item.status === "RETURNED"
  ) {
    return { eligible: false, message: "Return already processed" };
  }

  const deliveredStatus = item.statusTimeline.find(
    (s) => s.status === "DELIVERED"
  );

  if (!deliveredStatus) {
    return { eligible: false, message: "Delivery date not found" };
  }

  const daysPassed =
    (Date.now() - new Date(deliveredStatus.at).getTime()) /
    (1000 * 60 * 60 * 24);

  if (daysPassed > RETURN_WINDOW_DAYS) {
    return { eligible: false, message: "Return window expired" };
  }

  return { eligible: true };
};
