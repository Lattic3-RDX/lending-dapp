/* ------------------ Imports ----------------- */
use scrypto::prelude::*;
use scrypto_avltree::{AvlTree, NodeIterator, NodeIteratorMut};

/* ------------------- Types ------------------ */
pub type ValueMap = HashMap<ResourceAddress, PreciseDecimal>;
pub type ValueTuple = (ResourceAddress, PreciseDecimal);

/* ---------- Mathematical Operations --------- */
pub fn trunc(precise: PreciseDecimal) -> Decimal {
    return precise.checked_truncate(RoundingMode::ToZero).unwrap();
}

/* ------------------ LazyVec ----------------- */
/// State explosion-safe vector; builds on Ociswap's AvlTree library
#[derive(ScryptoSbor)]
pub struct LazyVec<T: ScryptoSbor + Clone + Debug + PartialEq> {
    pub inner: AvlTree<Decimal, T>,
    length: Decimal,
}

impl<T: ScryptoSbor + Clone + Debug + PartialEq> LazyVec<T> {
    /// Create an empty LazyVec instance
    pub fn new() -> Self {
        LazyVec { inner: AvlTree::new(), length: dec!(0) }
    }

    pub fn get_length(&self) -> Decimal {
        self.length
    }

    /// Add an element to the end of the vector, returns the index of the element
    pub fn append(&mut self, el: T) -> Decimal {
        self.inner.insert(self.get_length(), el);
        self.length = self.get_length().checked_add(dec!(1)).unwrap();
        self.get_length()
    }

    // TODO: re-assign the indexes of all other elements
    pub fn remove(&mut self, i: &Decimal) -> Option<T> {
        self.length = self.get_length().checked_sub(dec!(1)).unwrap();
        self.inner.remove(i)
    }

    /// Removes the first occurence of T, returns the index of the removed element
    pub fn pop(&mut self, flag: T) -> Option<Decimal> {
        let mut found: bool = false;
        let mut index: Decimal = Decimal::MIN;

        // Linearly search the AvlTree for the element
        for (i, el, _) in self.iter() {
            if el == flag {
                found = true;
                index = i;
                break;
            }
        }

        if !found {
            return None;
        }

        // Re-insert all the vec elements
        let mut pos: Decimal = dec!(-1);
        let mut updated_vec: AvlTree<Decimal, T> = AvlTree::new();
        for (i, el, _) in self.iter() {
            if i != index {
                pos = pos.checked_add(dec!(1)).expect("Unable to increment Decimal");
                updated_vec.insert(pos, el);
            }
        }

        self.length = self.get_length().checked_sub(dec!(1)).unwrap();
        self.inner = updated_vec;
        Some(index)
    }

    /// Identical to .pop() but with different logic (single for loop, no early exit), implementation being tested for speed
    pub fn pop_2(&mut self, flag: T) -> Option<Decimal> {
        let mut found: bool = false;
        let mut index: Decimal = Decimal::MIN;

        let mut pos: Decimal = dec!(-1);
        let mut updated_vec: AvlTree<Decimal, T> = AvlTree::new();

        // Linearly search the AvlTree for the element
        for (i, el, _) in self.iter() {
            if el == flag {
                found = true;
                index = i;
            } else {
                pos = pos.checked_add(dec!(1)).expect("Unable to increment Decimal");
                updated_vec.insert(pos, el);
            }
        }

        if !found {
            return None;
        }

        self.length = self.get_length().checked_sub(dec!(1)).unwrap();
        self.inner = updated_vec;
        Some(index)
    }

    /// Searches for the first occurence of T, and returns its index if found
    pub fn find(&self, flag: &T) -> Option<Decimal> {
        for (i, el, _) in self.inner.range(dec!(0)..self.get_length()) {
            if &el == flag {
                return Some(i);
            }
        }

        None
    }

    pub fn iter(&self) -> NodeIterator<Decimal, T> {
        self.inner.range(dec!(0)..self.get_length())
    }

    pub fn iter_mut(&mut self) -> NodeIteratorMut<Decimal, T> {
        self.inner.range_mut(dec!(0)..self.get_length())
    }

    /// Generate new AvlTree with the same elements and length
    pub fn clone(&self) -> LazyVec<T> {
        let mut cloned_inner: AvlTree<Decimal, T> = AvlTree::new();
        for (i, el, _) in self.iter() {
            cloned_inner.insert(i, el);
        }

        LazyVec { inner: cloned_inner, length: self.length }
    }

    /// Generate a new Vec with the same elements
    pub fn to_vec(&self) -> Vec<T> {
        let mut vec: Vec<T> = Vec::new();
        for (_, el, _) in self.iter() {
            vec.push(el);
        }

        vec
    }
}
