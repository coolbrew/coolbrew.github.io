---
title: 'Array Striding'
description: 'Explore how striding describes common NDArray operations'
pubDate: 'Oct 24 2026'
heroImage: '/blog-placeholder-1.jpg'
tags: ["ML"]
---

**Striding** is a cool concept in efficiently managing matrix (or more generally, N-dimensional array, aka *NDArray*) operations. To visualize the concept easier, let's first consider the simple example of a matrix (aka 2D array).

![](/blog/array-striding/2d-array.svg)

## How does matrix traversal work?
When we think of a matrix, we picture it as a $M \times N$ 2D block. However, because the computer memory is essentially a giant 1D array, the matrix is actually stored in the same way: a 1D array with length of $M \times N$. That introduces a crucial mindset: the 1D array is the *physical representation* of the matrix, while the canonical 2D block is the *logical view* specifying how we want to interpret the underlying 1D array. Here, we are visualizing a **row-major** array, meaning each row is stored in the buffer consecutively. Alternatively, there are [column-major arrays](https://en.wikipedia.org/wiki/Row-_and_column-major_order) whose columns are stored consecutively instead.

![](/blog/array-striding/buffer.svg)

Now think of a simple traversal:
```c
/*Traverse a 2D array of shape (M, N)*/
void traverse(int M, int N, int A[M][N]) {
	for (int m = 0; m < M; m++) {
		for (int n = 0; n < N; n++) {
			printf("%d\n", A[m][n]);
		}
	}
}
```
Reminder that logically we want the program to traverse the $M \times N$ *logical view* of our 2D array in order (i.e. print out all elements from left to right in the first row, then the second row, etc.). How can the program follow this order when traversing the 1D physical array?

Well, we know the 1D physical array must start with element `A[0][0]`. To find the address of element `A[m][n]`, we simply need to know its *offset* to `A[0][0]`, and add that offset value to the address of `A[0][0]`. So how do we compute the offset? For `A[m][n]`, we can view it as first skipping `m` rows, where each row has `N` elements, and add another `n` elements.
$$
\begin{aligned}
&\mathtt{offset}(A[m][n]) = m \times N + n \\
&\mathtt{addr}(A[m][n]) = \mathtt{addr}(A[0][0]) + \mathtt{offset}(A[m][n]) \\
\end{aligned}
$$
That's the core idea of traversing a (row-major) array!
## Striding
Now let's generalize on the idea we just walked through. To find the address of any element in an NDArray, we simply need to compute the *offset* to the start of the NDArray. The example was in 2D. Let's think about a 3D case in *logical view* $M \times N \times P$:
$$
\begin{aligned}
&\mathtt{offset}(A[m][n][p]) = m \times N \times P + n \times P + p \\
&\mathtt{addr}(A[m][n][p]) = \mathtt{addr}(A[0][0][0]) + \mathtt{offset}(A[m][n][p]) \\
\end{aligned}
$$
Look at how we derived this. Picture a 3D array as a cube (precisely, a cuboid), and each layer is a $N\times P$ 2D array, stacked on top of each other by $M$ times. So effectively we first skipped `m` layers, then skipped `n` rows, and finally another `p` elements.

Notice how essentially we are doing this computation:
$$
\begin{aligned}
&\mathtt{offset}=\sum_{d=0}^{D-1}i_ds_d \\
&D=\text{number of dimensions in A}, i_d=\text{logical index} \\
\end{aligned}
$$
Where $s_d$ is how many elements we skip on dimension `d`. That is known as the **stride**, so in the 2D example, `A[M][N]` had stride of `(N,1)`, and in the 3D example, `A[M][N][P]` had stride of `(NP,P,1)`. With this handy definition, we now have the universal tool needed to traverse a 1D physical array into a ND logical view. Let's explore what cool things can striding do.
### Reshape
I have been emphasizing the difference between physical representation and logical view because now we will look at how we can achieve different logical views from the exact same physical representation. Let's say we want to reshape our 2D array from shape `(3,4)` to `(2,6)`. Striding let's us do this without changing the underlying physical representation.

Recall that `A[3][4]` has stride `(4,1)`. To reshape to `(2,6)`, we only need to tell the program to skip 6 elements on the first dimension instead of 4, which means we just need to change our stride to `(6,1)`. That's the only thing we need to do.

Let's walk through a visualization:

**Row 0 - offset 0**
![](/blog/array-striding/reshape-1.svg)
![](/blog/array-striding/reshape-buf-1.svg)

**Row 1 - offset 1**
![](/blog/array-striding/reshape-2.svg)
![](/blog/array-striding/reshape-buf-2.svg)

### Broadcast
Another useful operation is broadcasting, which means duplicating the array on some dimension for a number of times. Let's say we want to broadcast our 2D array from shape `(3,4)` to `(3,4,3)`. In reality, we need to first explicitly insert a new dimension before the broadcast so the shape becomes `(3,4,1)`, but that does not change our logic.

How do we duplicate, or repeat, the access to the same element in the physical representation? Well, recall the definition of a stride is how many elements to skip on the corresponding dimension. So we can insert a stride of 0, making the new stride `(4,1,0)`. For example,
$$
\begin{aligned}
&\mathtt{offset}(A[m][n][0]) = 4\cdot m+1\cdot n+0\cdot 0 = 4m+n \\
&\mathtt{offset}(A[m][n][1]) = 4\cdot m+1\cdot n+0\cdot 1 = 4m+n \\
&\mathtt{offset}(A[m][n][2]) = 4\cdot m+1\cdot n+0\cdot 2 = 4m+n \\
\end{aligned}
$$

![](/blog/array-striding/broadcast.svg)

We are able to logically duplicate the same element on the newly added third dimension!

### Permute
Permuting the axes (or as we have been referring to as dimensions) of an NDArray is very useful in machine learning. In our 2D array example, if we swap axes 0 and 1, we effectively want to transform the matrix from shape `(3,4)` to `(4,3)`. But it's different from reshaping because the logical ordering of elements is different! Tracing the element `A[1][0]` for example. If I reshape to `(4,3)`, it will end up in `A[1][1]`. But with permute/transpose, it will end up in `A[0][1]`.

Let's think how we can do this. Our original `(3,4)` array had stride `(4,1)`, telling it to skip 4 elements on the first dimension, and 1 element on the second. If we swap the axes, we need to skip 1 element on the first dimension, and 4 elements on the second. That's it -- rearrange the strides would do the trick.

Let's also do a visualization:

**Row 0 (Col 0 in original array)**
![](/blog/array-striding/trans-1.svg)
![](/blog/array-striding/trans-buf-1.svg)
**Row 1 (Col 1 in original array)**
![](/blog/array-striding/trans-2.svg)
![](/blog/array-striding/trans-buf-2.svg)
**Row 2 (Col 2 in original array)**
![](/blog/array-striding/trans-3.svg)
![](/blog/array-striding/trans-buf-3.svg)
**Row 3 (Col 3 in original array)**
![](/blog/array-striding/trans-4.svg)
![](/blog/array-striding/trans-buf-4.svg)

### Composing
One cool thing of striding is that we can nest striding operations and it will still work. Imagine we do this operation:
$$
\text{Transpose}(\text{Reshape}(A))
$$
Striding allows us to nest the operations we just walked through, all without changing the physical representation in the memory buffer. However, when an array is no longer row-major (such as after a transpose), we might still need a copy if we want to perform row-major operations (such as reshape) on it.

Just to mention *Offset* (capitalized), which defines the starting point of our traversal, if it is no longer `A[0][0]`. For example, we want to slice out our `(3,4)` matrix and remove the first row. Well, our stride doesn't need to change, but only need to start the traversal at `A[1][0]` instead of `A[0][0]`.
$$
\mathtt{addr}(A[m][n]) =\mathtt{addr}(A[0][0]) + \text{Offset} + m\times N + n
$$
...on a side note, that is surprisingly similar to the X86-64 memory accessing notation:
$$
\text{displacement(base, index, scale)} = \text{Mem[base + index * scale + displacement]}
$$
I had a hard time comprehending why we need to separate out base and displacement while they are both constants, and they serve the exact same purpose as the Offset and `&A[0][0]` in our walk through, respectively.
## Summary
An NDArray is not necessarily a chunk of memory arranged in its logical shape. It is a logical indexing scheme over an underlying storage buffer. There are caveats as to combine the striding operations we discussed above, but this writeup is to explore the general idea of why striding makes sense in manipulating NDArrays. To summarize, we can achieve a generalized equation to find an element in an NDArray with $D$ dimensions by logical order in a 1D buffer:
$$
\text{addr}(i_0,...,i_{D-1})=B+w\left(O+\sum_{d=0}^{D-1}i_ds_d\right)
$$
- $B$: start byte address of the 1D buffer
- $w$: word size, i.e. byte size of elements in the buffer
- $O$: element Offset from beginning element
- $i_d$: logical index on dimension $d$
- $s_d$: stride amount on dimension $d$