# Reference - Smart and dumb files, worked

The rule is in `${CLAUDE_PLUGIN_ROOT}/skills/shared/architecture.md`. This is what it
looks like in code, and what each violation actually costs.

---

## The default that breaks it

```tsx
// components/OrderList.tsx  -  does everything
export function OrderList() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const { customerId } = useParams();

  useEffect(() => {
    fetch(`/api/customers/${customerId}/orders`)
      .then(r => r.json())
      .then(d => { setOrders(d); setLoading(false); });
  }, [customerId]);

  if (loading) return <Spinner />;
  return <ul>{orders.map(o => <li key={o.id}>{o.total}</li>)}</ul>;
}
```

Four things are now impossible, and none of them show up as a failing test:

1. **It cannot be tested without a network stub.** Every test of the list markup is also
   a test of fetching.
2. **It cannot be previewed** in Storybook or any component explorer without mocking the
   router and the network.
3. **It cannot be reused** on the admin screen, which has the same list and a different
   data source.
4. **The empty and error states do not exist** - and you will not notice, because the
   happy path renders.

---

## The split

**Dumb** - props in, events out. No fetch, no router, no store, no clock.

```tsx
// components/OrderList.tsx        role: dumb
type Props = {
  orders: Order[];
  state: 'ready' | 'loading' | 'empty' | 'error';
  onRetry: () => void;
};

export function OrderList({ orders, state, onRetry }: Props) {
  if (state === 'loading') return <Spinner label="Loading orders" />;
  if (state === 'error')   return <ErrorNotice onRetry={onRetry} />;
  if (state === 'empty')   return <EmptyState message="No orders yet" />;

  return (
    <ul>
      {orders.map(o => <OrderRow key={o.id} order={o} />)}
    </ul>
  );
}
```

**Smart** - knows where data comes from, and owns the state branches.

```tsx
// features/orders/OrderListContainer.tsx     role: smart
export function OrderListContainer() {
  const { customerId } = useParams();
  const { data, isLoading, isError, refetch } = useCustomerOrders(customerId);

  return (
    <OrderList
      orders={data ?? []}
      state={isLoading ? 'loading' : isError ? 'error' : data?.length ? 'ready' : 'empty'}
      onRetry={refetch}
    />
  );
}
```

**The data access, once**, in a hook the container uses:

```ts
// features/orders/useCustomerOrders.ts       role: smart (data)
export function useCustomerOrders(customerId: string) {
  return useQuery({
    queryKey: ['orders', customerId],
    queryFn: () => ordersApi.listForCustomer(customerId),
  });
}
```

Now `OrderList` renders in a test with four lines and no mocks, and every state has a
test because every state is a prop value:

```tsx
it('offers a retry when loading failed', async () => {
  const onRetry = vi.fn();
  render(<OrderList orders={[]} state="error" onRetry={onRetry} />);
  await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
  expect(onRetry).toHaveBeenCalled();
});
```

---

## Angular

The tell is injection. A dumb component **never** injects a service.

```ts
// order-list.component.ts                    role: dumb
@Component({
  selector: 'app-order-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `...`,
})
export class OrderListComponent {
  orders = input.required<Order[]>();
  state  = input.required<ListState>();
  retry  = output<void>();
  // no constructor, no inject() - that is the whole discipline
}
```

```ts
// order-list-page.component.ts               role: smart
@Component({ standalone: true, imports: [OrderListComponent], template: `...` })
export class OrderListPageComponent {
  private readonly orders = inject(OrderService);
  protected readonly vm = toSignal(this.orders.forCurrentCustomer());
}
```

## Vue

Logic lives in a composable the container calls. A composable invoked from a leaf SFC is
the same violation as an injected service in a dumb Angular component.

```vue
<!-- OrderList.vue                             role: dumb -->
<script setup lang="ts">
defineProps<{ orders: Order[]; state: ListState }>();
defineEmits<{ retry: [] }>();
</script>
```

```vue
<!-- OrderListPage.vue                         role: smart -->
<script setup lang="ts">
const { orders, state, retry } = useCustomerOrders(route.params.customerId);
</script>
```

---

## Backend: the same rule, other names

```py
# BEFORE - transport, rules and SQL in one function
@router.post("/orders")
async def create_order(req: Request, db: Session = Depends(get_db)):
    body = await req.json()
    if body["total"] > 10_000 and not body.get("approved_by"):
        raise HTTPException(400, "large orders need approval")
    db.execute(text("INSERT INTO orders ..."))
    return {"ok": True}
```

The approval rule - the only part with real business value - now needs an HTTP client
and a database to test.

```py
# transport/orders.py                          role: transport
@router.post("/orders", response_model=OrderOut)
async def create_order(body: OrderIn, svc: OrderService = Depends(get_order_service)):
    return svc.place(body.to_command())        # parse, delegate, serialise

# services/orders.py                           role: service  - no framework, no ORM
class OrderService:
    def __init__(self, orders: OrderRepository):   # the PORT, injected
        self._orders = orders

    def place(self, cmd: PlaceOrder) -> Order:
        if cmd.total > LARGE_ORDER_THRESHOLD and not cmd.approved_by:
            raise ApprovalRequired(cmd.total)   # the rule, testable in isolation
        return self._orders.add(Order.from_command(cmd))

# adapters/sql_orders.py                        role: adapter
class SqlOrderRepository(OrderRepository):      # implements the port
    ...
```

`OrderService` now unit-tests against a fake repository in milliseconds, with no
database. **That is the proof the split worked** - not the directory names.

The two moves that silently undo it, both of which compile:

- `self._orders = SqlOrderRepository()` inside the service - the adapter is welded in.
- `from app.db import session` at the top of a service module - same weld, less visible.

Wire concretes at one composition root.

---

## Checking your own diff

| Question | If the answer is yes |
|---|---|
| Does a file in `components/` import a data client, store or router? | it is smart wearing a dumb name - move the import up |
| Does a dumb component have a third layout-mode boolean prop? | it is two components sharing a name - split it |
| Does a service import a driver, an SDK, or a framework request type? | the dependency is inverted - declare a port |
| Does a unit test need a database or a network? | the seam is missing, not the mock |
| Are loading, empty, error and unauthorised all represented? | good - if not, the component is half-built |
