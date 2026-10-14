"""Create or update Stripe products/prices for DataFlow Pro plan. Idempotent."""
import os
from dotenv import load_dotenv
import stripe

load_dotenv()
stripe.api_key = os.environ["STRIPE_SECRET_KEY"]

CATALOG = [
    {
        "emergent_product_id": "dataflow_pro",
        "name": "DataFlow Pro",
        "tax_code": "txcd_10103001",  # SaaS
        "prices": [
            {"lookup_key": "dataflow_pro_monthly", "amount": 1900, "currency": "usd", "interval": "month"},
        ],
    },
]


def ensure_tax_settings():
    try:
        s = stripe.tax.Settings.retrieve()
        if s.head_office and getattr(s.head_office, "address", None):
            return
        stripe.tax.Settings.modify(
            head_office={"address": {
                "country": "NL", "line1": "Amsterdam",
                "city": "Amsterdam", "state": "", "postal_code": "1000AA",
            }},
            defaults={"tax_behavior": "exclusive"},
        )
        print("Tax settings configured")
    except Exception as e:
        print(f"Tax settings skip: {e}")


def get_or_create_product(entry):
    for p in stripe.Product.list(active=True).auto_paging_iter():
        if p.to_dict().get("metadata", {}).get("emergent_product_id") == entry["emergent_product_id"]:
            print(f"Product exists: {p.id}")
            return p
    p = stripe.Product.create(
        name=entry["name"],
        tax_code=entry.get("tax_code"),
        metadata={"managed_by": "emergent", "emergent_product_id": entry["emergent_product_id"]},
    )
    print(f"Product created: {p.id}")
    return p


def ensure_price(product, p):
    existing = stripe.Price.list(lookup_keys=[p["lookup_key"]], active=True, limit=1).data
    if existing and (existing[0].unit_amount != p["amount"] or existing[0].currency != p["currency"]):
        stripe.Price.modify(existing[0].id, active=False)
        existing = []
    if existing:
        print(f"Price exists: {existing[0].id} ({p['lookup_key']})")
        return existing[0]
    kwargs = dict(
        product=product.id,
        unit_amount=p["amount"],
        currency=p["currency"],
        lookup_key=p["lookup_key"],
        transfer_lookup_key=True,
    )
    if p.get("interval"):
        kwargs["recurring"] = {"interval": p["interval"]}
    price = stripe.Price.create(**kwargs)
    print(f"Price created: {price.id} ({p['lookup_key']})")
    return price


def main():
    ensure_tax_settings()
    for entry in CATALOG:
        product = get_or_create_product(entry)
        for p in entry["prices"]:
            ensure_price(product, p)
    print("Done.")


if __name__ == "__main__":
    main()
